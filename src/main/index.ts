import { app, BaseWindow, nativeTheme } from "electron"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import icon from "@resources/icon.png?asset"
import type {
  BrowserNavigationCommand,
  PhotonBrowserUpdate,
  PhotonBrowserUpdateEnvelope,
  PhotonSnapshot,
  TabId,
} from "@/preload/photon-api"
import { TabManager } from "./browser/tab-manager"
import { createInternalPageRegistry } from "./browser/internal-pages.mts"
import { WindowComposition } from "./window/window-composition"
import {
  registerBrowserIpc,
  NAVIGATION_COMMAND_CHANNEL,
  sendBrowserUpdates,
  sendOmniboxFocus,
  unregisterBrowserIpc,
} from "./ipc/browser-ipc"
import { registerBrowserShortcuts } from "./window/browser-shortcuts"
import { DownloadManager } from "./browser/download-manager.mts"
import { PHOTON_THEME_COLORS } from "@/shared/theme-colors"
import { createChromeView, loadChromeView } from "./views/chrome-view"
import { configureBrowserSession } from "./sessions/browser-session"

async function createBrowserWindow(): Promise<void> {
  const isMac = process.platform === "darwin"
  const windowBackground = nativeTheme.shouldUseDarkColors
    ? PHOTON_THEME_COLORS.darkWindowBackground
    : PHOTON_THEME_COLORS.lightWindowBackground
  const showPerformanceOverlay = !app.isPackaged && process.env["PHOTON_SHOW_PERF_OVERLAY"] === "1"
  const browserWindow = new BaseWindow({
    width: 1100,
    height: 760,
    show: false,
    // Keep the chrome edge opaque while the renderer hosts the page-area webview.
    backgroundColor: windowBackground,
    autoHideMenuBar: true,
    ...(isMac ? { titleBarStyle: "hiddenInset" as const } : { frame: false }),
    ...(process.platform === "linux" ? { icon } : {}),
  })
  const chromeView = createChromeView()
  const composition = new WindowComposition(browserWindow, chromeView)
  const focusOmniboxInChrome = (): void => {
    composition.focusChrome()
    sendOmniboxFocus(chromeView.webContents)
  }
  let tabManager: TabManager | undefined
  const downloadManager = new DownloadManager(chromeView.webContents)
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
      sendBrowserUpdates(chromeView.webContents, updates)
    }, 16)
  }
  let unregisterShortcuts = (): void => undefined
  let unregisterBrowserSession = (): void => undefined
  let isCleanedUp = false
  const cleanup = (): void => {
    if (isCleanedUp) return
    isCleanedUp = true
    tabManager?.dispose()
    composition.dispose()
    unregisterShortcuts()
    unregisterBrowserSession()
    unregisterBrowserIpc()
    downloadManager.dispose()
    if (updateFlushTimer !== undefined) clearTimeout(updateFlushTimer)
    pendingUpdates.clear()
    tabManager = undefined
  }

  tabManager = new TabManager({
    onChange: emitUpdate,
    onFocusOmnibox: focusOmniboxInChrome,
    onFocusPage: (tabId) => sendNavigationCommand(chromeView.webContents, tabId, "focus"),
    onNavigationCommand: (tabId, command) =>
      sendNavigationCommand(chromeView.webContents, tabId, command),
    onCloseWindow: () => browserWindow.close(),
    pages: internalPages,
  })
  unregisterBrowserSession = configureBrowserSession(chromeView.webContents, (url) => {
    if (!tabManager) throw new Error("Photon tab manager is not ready")
    return tabManager.createTab(url)
  })
  registerBrowserIpc({
    browserWindow,
    chromeWebContents: chromeView.webContents,
    tabManager,
    getSnapshot,
    downloadManager,
  })
  unregisterShortcuts = registerBrowserShortcuts({
    browserWindow,
    chromeWebContents: chromeView.webContents,
    tabManager,
    focusOmnibox: focusOmniboxInChrome,
  })
  browserWindow.on("maximize", () =>
    emitUpdate({ type: "window-maximized-changed", isMaximized: true }),
  )
  browserWindow.on("unmaximize", () =>
    emitUpdate({ type: "window-maximized-changed", isMaximized: false }),
  )
  chromeView.webContents.once("did-finish-load", () => {
    // This is the first point where chrome has painted and the initial native layout is stable.
    composition.initialize()
    const activeTabId = tabManager?.getSnapshot().activeTabId
    if (activeTabId) void tabManager?.activateTab(activeTabId)
    browserWindow.show()
  })
  browserWindow.once("closed", cleanup)

  loadChromeView(chromeView, getChromePageUrl(showPerformanceOverlay))
}

function sendNavigationCommand(
  chromeWebContents: Electron.WebContents,
  tabId: TabId,
  command: BrowserNavigationCommand,
): void {
  if (!chromeWebContents.isDestroyed()) {
    chromeWebContents.send(NAVIGATION_COMMAND_CHANNEL, tabId, command)
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

function getChromePageUrl(includePerformanceDiagnostics = false): string {
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"]
  if (rendererUrl) {
    const baseUrl = rendererUrl.endsWith("/") ? rendererUrl : rendererUrl + "/"
    return getChromeUrl(new URL("index.html", baseUrl), includePerformanceDiagnostics)
  }
  return getChromeUrl(
    pathToFileURL(join(__dirname, "../renderer/index.html")),
    includePerformanceDiagnostics,
  )
}

function getChromeUrl(url: URL, includePerformanceDiagnostics: boolean): string {
  if (includePerformanceDiagnostics) url.searchParams.set("perf", "1")
  return url.toString()
}

void app.whenReady().then(() => {
  nativeTheme.themeSource = "system"
  void createBrowserWindow()

  app.on("activate", () => {
    if (BaseWindow.getAllWindows().length === 0) void createBrowserWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
