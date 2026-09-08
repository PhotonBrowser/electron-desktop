import { ipcMain, type BrowserWindow } from "electron"
import type { DownloadId, PhotonSnapshot, TabId } from "@/preload/photon-api"
import type { TabManager } from "../browser/tab-manager"
import type { DownloadManager } from "../browser/download-manager.mts"

export const SNAPSHOT_CHANNEL = "photon:browser-snapshot"
export const FOCUS_OMNIBOX_CHANNEL = "photon:focus-omnibox"

interface BrowserIpcContext {
  browserWindow: BrowserWindow
  tabManager: TabManager
  getSnapshot: () => PhotonSnapshot
  downloadManager: DownloadManager
}

function isTabIdList(value: unknown): value is TabId[] {
  return Array.isArray(value) && value.every((tabId): tabId is TabId => typeof tabId === "string")
}

function isDownloadId(value: unknown): value is DownloadId {
  return typeof value === "string" && /^download-\d+$/.test(value)
}

export function registerBrowserIpc(context: BrowserIpcContext): void {
  const { browserWindow, tabManager, getSnapshot, downloadManager } = context

  ipcMain.handle("photon:browser:get-snapshot", () => getSnapshot())
  ipcMain.handle("photon:tabs:create", () => tabManager.createTab())
  ipcMain.handle("photon:tabs:select", (_event, tabId: TabId) => tabManager.selectTab(tabId))
  ipcMain.handle("photon:tabs:close", (_event, tabId: TabId) => tabManager.closeTab(tabId))
  ipcMain.handle("photon:tabs:reorder", (_event, tabIds: unknown) => {
    if (isTabIdList(tabIds)) tabManager.reorderTabs(tabIds)
  })
  ipcMain.handle("photon:navigation:back", () => tabManager.back())
  ipcMain.handle("photon:navigation:forward", () => tabManager.forward())
  ipcMain.handle("photon:navigation:reload", () => tabManager.reload())
  ipcMain.handle("photon:navigation:navigate", (_event, url: string) =>
    tabManager.navigateActive(url),
  )
  ipcMain.handle("photon:window:minimize", () => browserWindow.minimize())
  ipcMain.handle("photon:window:toggle-maximize", () => {
    if (browserWindow.isMaximized()) browserWindow.unmaximize()
    else browserWindow.maximize()
  })
  ipcMain.handle("photon:window:close", () => browserWindow.close())
  ipcMain.handle("photon:downloads:get-snapshot", () => downloadManager.getSnapshot())
  for (const action of ["cancel", "pause", "resume", "open", "showInFolder"] as const) {
    ipcMain.handle(`photon:downloads:${action}`, (_event, id: unknown) => {
      if (!isDownloadId(id)) return
      return downloadManager[action](id)
    })
  }
}

export function sendSnapshot(
  browserWindow: BrowserWindow,
  getSnapshot: BrowserIpcContext["getSnapshot"],
): void {
  if (!browserWindow.webContents.isDestroyed()) {
    browserWindow.webContents.send(SNAPSHOT_CHANNEL, getSnapshot())
  }
}

export function focusOmnibox(browserWindow: BrowserWindow): void {
  if (browserWindow.isDestroyed()) return
  browserWindow.focus()
  const { webContents } = browserWindow
  if (!webContents.isDestroyed()) {
    webContents.focus()
    webContents.send(FOCUS_OMNIBOX_CHANNEL)
  }
}

export function unregisterBrowserIpc(): void {
  ipcMain.removeHandler("photon:browser:get-snapshot")
  ipcMain.removeHandler("photon:tabs:create")
  ipcMain.removeHandler("photon:tabs:select")
  ipcMain.removeHandler("photon:tabs:close")
  ipcMain.removeHandler("photon:tabs:reorder")
  ipcMain.removeHandler("photon:navigation:back")
  ipcMain.removeHandler("photon:navigation:forward")
  ipcMain.removeHandler("photon:navigation:reload")
  ipcMain.removeHandler("photon:navigation:navigate")
  ipcMain.removeHandler("photon:window:minimize")
  ipcMain.removeHandler("photon:window:toggle-maximize")
  ipcMain.removeHandler("photon:window:close")
  for (const action of ["cancel", "pause", "resume", "open", "showInFolder"] as const) {
    ipcMain.removeHandler(`photon:downloads:${action}`)
  }
  ipcMain.removeHandler("photon:downloads:get-snapshot")
}
