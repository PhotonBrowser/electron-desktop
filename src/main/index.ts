import { app, BrowserWindow, nativeTheme } from "electron"
import { join } from "node:path"
import icon from "@resources/icon.png?asset"
import type { PhotonSnapshot } from "@/preload/photon-api"
import { TabManager } from "./browser/tab-manager"
import { loadSession, SessionStore } from "./browser/session-store"
import { createInternalPageRegistry } from "./browser/internal-pages.mts"
import {
  focusOmnibox,
  registerBrowserIpc,
  sendSnapshot,
  unregisterBrowserIpc,
} from "./ipc/browser-ipc"
import { registerBrowserShortcuts } from "./window/browser-shortcuts"
import { DownloadManager } from "./browser/download-manager.mts"

async function createBrowserWindow(): Promise<void> {
  const isMac = process.platform === "darwin"
  const browserWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    backgroundColor: "#00000000",
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

  let tabManager: TabManager | undefined
  const sessionStore = new SessionStore()
  const downloadManager = new DownloadManager(browserWindow)
  const internalPages = createInternalPageRegistry(app.getName())
  const getSnapshot = (): PhotonSnapshot => {
    if (!tabManager) throw new Error("Photon tab manager is not ready")
    return {
      ...tabManager.getSnapshot(),
      isMaximized: browserWindow.isMaximized(),
    }
  }
  let snapshotQueued = false
  const emitSnapshot = (): void => {
    if (!tabManager || snapshotQueued) return
    snapshotQueued = true
    queueMicrotask(() => {
      snapshotQueued = false
      if (tabManager) sendSnapshot(browserWindow, getSnapshot)
    })
  }
  let unregisterShortcuts = (): void => undefined
  let isCleanedUp = false
  const cleanup = (): void => {
    if (isCleanedUp) return
    isCleanedUp = true
    tabManager?.dispose()
    unregisterShortcuts()
    unregisterBrowserIpc()
    downloadManager.dispose()
    tabManager = undefined
  }

  tabManager = new TabManager(
    browserWindow,
    emitSnapshot,
    () => focusOmnibox(browserWindow),
    internalPages,
    await loadSession(internalPages),
    (snapshot) => sessionStore.schedule(snapshot),
  )
  registerBrowserIpc({
    browserWindow,
    tabManager,
    getSnapshot,
    downloadManager,
  })
  unregisterShortcuts = registerBrowserShortcuts({
    browserWindow,
    tabManager,
    focusOmnibox: () => focusOmnibox(browserWindow),
  })
  browserWindow.on("maximize", emitSnapshot)
  browserWindow.on("unmaximize", emitSnapshot)
  browserWindow.once("ready-to-show", () => {
    browserWindow.show()
    emitSnapshot()
  })
  let closeRequested = false
  browserWindow.on("close", (event) => {
    if (closeRequested) {
      cleanup()
      return
    }
    event.preventDefault()
    closeRequested = true
    void sessionStore.flush().finally(() => browserWindow.close())
  })
  browserWindow.once("closed", cleanup)

  if (process.env["ELECTRON_RENDERER_URL"]) {
    void browserWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    void browserWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
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
