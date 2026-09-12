import { app, BaseWindow, nativeTheme } from "electron"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import icon from "@resources/icon.png?asset"
import type { PhotonNavigationRequest, PhotonSnapshot } from "@/shared/photon-api"
import { IPC_CHANNELS } from "@/shared/ipc-channels"
import { TabManager } from "./browser/tab-manager"
import { createInternalPageRegistry } from "./browser/internal-pages.mts"
import { WindowComposition } from "./window/window-composition"
import { registerBrowserIpc, sendOmniboxFocus, unregisterBrowserIpc } from "./ipc/browser-ipc"
import { createBrowserUpdateQueue } from "./ipc/browser-update-queue"
import { registerBrowserShortcuts } from "./window/browser-shortcuts"
import { DownloadManager } from "./browser/download-manager.mts"
import { createChromeView, loadChromeView } from "./views/chrome-view"
import { configureBrowserSession } from "./sessions/browser-session"

async function createBrowserWindow(): Promise<void> {
  const isMac = process.platform === "darwin"
  const showPerformanceOverlay = !app.isPackaged && process.env["PHOTON_SHOW_PERF_OVERLAY"] === "1"
  const browserWindow = new BaseWindow({
    width: 1100,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    autoHideMenuBar: true,
    ...(isMac ? { titleBarStyle: "hiddenInset" as const } : { frame: false }),
    ...(process.platform === "linux" ? { icon } : {}),
  })
  browserWindow.setBackgroundColor("#00000000")
  const chromeView = createChromeView()
  const composition = new WindowComposition(browserWindow, chromeView)
  const focusOmniboxInChrome = (): void => {
    composition.focusChrome()
    sendOmniboxFocus(chromeView.webContents)
  }
  let tabManager: TabManager | undefined
  const downloadManager = new DownloadManager(chromeView.webContents)
  const internalPages = createInternalPageRegistry(app.getName())
  const updateQueue = createBrowserUpdateQueue(chromeView.webContents)
  const getSnapshot = (): PhotonSnapshot => {
    if (!tabManager) throw new Error("Photon tab manager is not ready")
    return {
      revision: updateQueue.getRevision(),
      ...tabManager.getSnapshot(),
      isMaximized: browserWindow.isMaximized(),
    }
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
    unregisterBrowserIpc(chromeView.webContents)
    downloadManager.dispose()
    updateQueue.dispose()
    tabManager = undefined
  }

  tabManager = new TabManager({
    onChange: updateQueue.enqueue,
    onFocusOmnibox: focusOmniboxInChrome,
    onFocusPage: (tabId) =>
      sendNavigationCommand(chromeView.webContents, { tabId, command: "focus" }),
    onNavigationCommand: (request) => sendNavigationCommand(chromeView.webContents, request),
    onCloseWindow: () => browserWindow.close(),
    pages: internalPages,
  })
  unregisterBrowserSession = configureBrowserSession(chromeView.webContents, (url) => {
    if (!tabManager) throw new Error("Photon tab manager is not ready")
    return tabManager.createTab(url, false)
  })
  registerBrowserIpc({
    browserWindow,
    chromeWebContents: chromeView.webContents,
    tabManager,
    getSnapshot,
    downloadManager,
    createWindow: () => {
      void createBrowserWindow()
    },
  })
  unregisterShortcuts = registerBrowserShortcuts({
    chromeWebContents: chromeView.webContents,
    tabManager,
    focusOmnibox: focusOmniboxInChrome,
  })
  browserWindow.on("maximize", () =>
    updateQueue.enqueue({ type: "window-maximized-changed", isMaximized: true }),
  )
  browserWindow.on("unmaximize", () =>
    updateQueue.enqueue({ type: "window-maximized-changed", isMaximized: false }),
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
  request: PhotonNavigationRequest,
): void {
  if (!chromeWebContents.isDestroyed()) {
    chromeWebContents.send(IPC_CHANNELS.navigation.command, request)
  }
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
