import { app, BrowserWindow, nativeTheme } from "electron"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import icon from "@resources/icon.png?asset"
import type {
  PhotonBrowserUpdate,
  PhotonBrowserUpdateEnvelope,
  PhotonSnapshot,
} from "@/preload/photon-api"
import { TabManager } from "./browser/tab-manager"
import { createInternalPageRegistry } from "./browser/internal-pages.mts"
import { WindowComposition } from "./window/window-composition"
import {
  registerBrowserIpc,
  sendBrowserUpdates,
  sendOmniboxFocus,
  unregisterBrowserIpc,
} from "./ipc/browser-ipc"
import { registerBrowserShortcuts } from "./window/browser-shortcuts"
import { DownloadManager } from "./browser/download-manager.mts"
import { PHOTON_THEME_COLORS } from "@/shared/theme-colors"

async function createBrowserWindow(): Promise<void> {
  const isMac = process.platform === "darwin"
  const windowBackground = nativeTheme.shouldUseDarkColors
    ? PHOTON_THEME_COLORS.darkWindowBackground
    : PHOTON_THEME_COLORS.lightWindowBackground
  const showPerformanceOverlay = !app.isPackaged && process.env["PHOTON_SHOW_PERF_OVERLAY"] === "1"
  const browserWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    // Keep the chrome edge opaque so the inset page view cannot show through it.
    backgroundColor: windowBackground,
    autoHideMenuBar: true,
    ...(isMac ? { titleBarStyle: "hiddenInset" as const } : { frame: false }),
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const composition = new WindowComposition(
    browserWindow,
    getOverlayPageUrl(showPerformanceOverlay),
  )
  const focusOmniboxInChrome = (): void => {
    composition.focusChrome()
    sendOmniboxFocus(browserWindow)
  }
  let tabManager: TabManager | undefined
  const downloadManager = new DownloadManager(browserWindow)
  const internalPages = createInternalPageRegistry(app.getName())
  let browserRevision = 0
  const getSnapshot = (): PhotonSnapshot => {
    if (!tabManager) throw new Error("Photon tab manager is not ready")
    return {
      revision: browserRevision,
      ...tabManager.getSnapshot(),
      isMaximized: browserWindow.isMaximized(),
    }
  }
  const pendingUpdates = new Map<string, PhotonBrowserUpdateEnvelope[]>()
  let updateFlushTimer: ReturnType<typeof setTimeout> | undefined
  const emitUpdate = (update: PhotonBrowserUpdate): void => {
    const envelope = { revision: ++browserRevision, update }
    const key = getUpdateKey(update)
    const pendingForKey = pendingUpdates.get(key) ?? []
    const previous = pendingForKey.at(-1)
    if (previous?.update.type === "tab-updated" && update.type === "tab-updated") {
      pendingForKey[pendingForKey.length - 1] = {
        revision: envelope.revision,
        update: {
          type: "tab-updated",
          tabId: update.tabId,
          changes: { ...previous.update.changes, ...update.changes },
        },
      }
    } else {
      pendingForKey.push(envelope)
    }
    pendingUpdates.set(key, pendingForKey)
    if (updateFlushTimer !== undefined) return

    // Main has no animation-frame clock. A short frame-sized window coalesces
    // bursts of WebContents events before crossing the process boundary.
    updateFlushTimer = setTimeout(() => {
      updateFlushTimer = undefined
      const updates = [...pendingUpdates.values()]
        .flat()
        .sort((first, second) => first.revision - second.revision)
      pendingUpdates.clear()
      sendBrowserUpdates(browserWindow, updates)
    }, 16)
  }
  let unregisterShortcuts = (): void => undefined
  let isCleanedUp = false
  const cleanup = (): void => {
    if (isCleanedUp) return
    isCleanedUp = true
    tabManager?.dispose()
    composition.dispose()
    unregisterShortcuts()
    unregisterBrowserIpc()
    downloadManager.dispose()
    if (updateFlushTimer !== undefined) clearTimeout(updateFlushTimer)
    pendingUpdates.clear()
    tabManager = undefined
  }

  tabManager = new TabManager({
    onChange: emitUpdate,
    onFocusOmnibox: focusOmniboxInChrome,
    onFocusPage: (view) => composition.focusPage(view),
    onPageViewChange: (view) => composition.attachActivePage(view),
    onCloseWindow: () => browserWindow.close(),
    pages: internalPages,
  })
  registerBrowserIpc({
    browserWindow,
    tabManager,
    getSnapshot,
    downloadManager,
    composition,
  })
  unregisterShortcuts = registerBrowserShortcuts({
    browserWindow,
    tabManager,
    focusOmnibox: focusOmniboxInChrome,
  })
  browserWindow.on("maximize", () =>
    emitUpdate({ type: "window-maximized-changed", isMaximized: true }),
  )
  browserWindow.on("unmaximize", () =>
    emitUpdate({ type: "window-maximized-changed", isMaximized: false }),
  )
  browserWindow.once("ready-to-show", () => {
    // This is the first point where chrome has painted and the initial native layout is stable.
    composition.initialize()
    const activeTabId = tabManager?.getSnapshot().activeTabId
    if (activeTabId) void tabManager?.activateTab(activeTabId)
    browserWindow.show()
    if (showPerformanceOverlay) composition.showOverlay({ kind: "perf" })
  })
  browserWindow.once("closed", cleanup)

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void browserWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    void browserWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

function getUpdateKey(update: PhotonBrowserUpdate): string {
  if (update.type === "tab-added") return `tab:${update.tab.id}`
  if (update.type === "tab-updated") return `tab:${update.tabId}`
  if (update.type === "tab-removed") return `tab:${update.tabId}`
  if (update.type === "tabs-reordered") return "tabs-order"
  if (update.type === "active-tab-changed") return "active-tab"
  return "window-maximized"
}

function getOverlayPageUrl(includePerformanceDiagnostics = false): string {
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"]
  if (rendererUrl) {
    const baseUrl = rendererUrl.endsWith("/") ? rendererUrl : rendererUrl + "/"
    return getOverlayUrl(new URL("overlay.html", baseUrl), includePerformanceDiagnostics)
  }
  return getOverlayUrl(
    pathToFileURL(join(__dirname, "../renderer/overlay.html")),
    includePerformanceDiagnostics,
  )
}

function getOverlayUrl(url: URL, includePerformanceDiagnostics: boolean): string {
  if (includePerformanceDiagnostics) url.searchParams.set("perf", "1")
  return url.toString()
}

void app.whenReady().then(() => {
  nativeTheme.themeSource = "system"
  void createBrowserWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createBrowserWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
