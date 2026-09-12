import { app, ipcMain, type BaseWindow, type IpcMainInvokeEvent, type WebContents } from "electron"
import { IPC_CHANNELS, DOWNLOAD_ACTIONS } from "@/shared/ipc-channels"
import type { PhotonPerformanceMetrics, PhotonSnapshot } from "@/shared/photon-api"
import {
  isDownloadId,
  isMemorySaverSettings,
  isString,
  isTabId,
  isTabIdList,
  isWebviewEventChanges,
} from "./ipc-validation"
import type { TabManager } from "../browser/tab-manager"
import type { DownloadManager } from "../browser/download-manager.mts"
import { collectMetrics } from "../performance/metrics-collector"

interface BrowserIpcContext {
  browserWindow: BaseWindow
  chromeWebContents: WebContents
  tabManager: TabManager
  getSnapshot: () => PhotonSnapshot
  downloadManager: DownloadManager
  createWindow: () => void
}

const contexts = new Map<number, BrowserIpcContext>()
let handlersRegistered = false

export function registerBrowserIpc(context: BrowserIpcContext): void {
  contexts.set(context.chromeWebContents.id, context)
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle(IPC_CHANNELS.browser.getSnapshot, (event) => contextFor(event).getSnapshot())
  ipcMain.handle(IPC_CHANNELS.tabs.create, (event) => contextFor(event).tabManager.createTab())
  ipcMain.handle(IPC_CHANNELS.tabs.select, (event, tabId: unknown) => {
    const context = contextFor(event)
    if (!context || !isTabId(tabId)) return undefined
    return context.tabManager.selectTab(tabId)
  })
  ipcMain.handle(IPC_CHANNELS.tabs.close, (event, tabId: unknown) => {
    const context = contextFor(event)
    if (context && isTabId(tabId)) context.tabManager.closeTab(tabId)
  })
  ipcMain.handle(IPC_CHANNELS.tabs.reorder, (event, tabIds: unknown) => {
    const context = contextFor(event)
    if (context && isTabIdList(tabIds)) context.tabManager.reorderTabs(tabIds)
  })
  ipcMain.handle(IPC_CHANNELS.tabs.update, (event, tabId: unknown, changes: unknown) => {
    const context = contextFor(event)
    if (!context || !isTabId(tabId) || !isWebviewEventChanges(changes)) return
    context.tabManager.updateFromWebview(tabId, changes)
  })
  ipcMain.handle(IPC_CHANNELS.navigation.back, (event) => contextFor(event).tabManager.back())
  ipcMain.handle(IPC_CHANNELS.navigation.forward, (event) => contextFor(event).tabManager.forward())
  ipcMain.handle(IPC_CHANNELS.navigation.reload, (event) => contextFor(event).tabManager.reload())
  ipcMain.handle(IPC_CHANNELS.navigation.stop, (event) =>
    contextFor(event).tabManager.stopLoading(),
  )
  ipcMain.handle(IPC_CHANNELS.navigation.navigate, (event, url: unknown) => {
    const context = contextFor(event)
    if (!context || !isString(url)) return undefined
    return context.tabManager.navigateActive(url)
  })
  ipcMain.handle(IPC_CHANNELS.window.minimize, (event) =>
    contextFor(event).browserWindow.minimize(),
  )
  ipcMain.handle(IPC_CHANNELS.window.toggleMaximize, (event) => {
    const browserWindow = contextFor(event)?.browserWindow
    if (!browserWindow) return
    if (browserWindow.isMaximized()) browserWindow.unmaximize()
    else browserWindow.maximize()
  })
  ipcMain.handle(IPC_CHANNELS.window.close, (event) => contextFor(event).browserWindow.close())
  ipcMain.handle(IPC_CHANNELS.window.newWindow, (event) => contextFor(event).createWindow())
  ipcMain.handle(IPC_CHANNELS.memorySaver.setSettings, (event, settings: unknown) => {
    const context = contextFor(event)
    if (context && isMemorySaverSettings(settings))
      context.tabManager.setMemorySaverSettings(settings)
  })
  ipcMain.handle(IPC_CHANNELS.downloads.getSnapshot, (event) =>
    contextFor(event).downloadManager.getSnapshot(),
  )
  if (!app.isPackaged) {
    ipcMain.handle(
      IPC_CHANNELS.performance.metrics,
      (event): PhotonPerformanceMetrics | undefined => {
        const context = contextFor(event)
        return context ? collectMetrics(context.tabManager) : undefined
      },
    )
  }
  for (const action of DOWNLOAD_ACTIONS) {
    ipcMain.handle(IPC_CHANNELS.downloads[action], (event, id: unknown) => {
      if (!isDownloadId(id)) return
      const context = contextFor(event)
      return context.downloadManager[action](id)
    })
  }
}

export function unregisterBrowserIpc(chromeWebContents: WebContents): void {
  contexts.delete(chromeWebContents.id)
  if (contexts.size > 0 || !handlersRegistered) return
  handlersRegistered = false
  const channels = [
    IPC_CHANNELS.browser.getSnapshot,
    IPC_CHANNELS.tabs.create,
    IPC_CHANNELS.tabs.select,
    IPC_CHANNELS.tabs.close,
    IPC_CHANNELS.tabs.reorder,
    IPC_CHANNELS.tabs.update,
    IPC_CHANNELS.navigation.back,
    IPC_CHANNELS.navigation.forward,
    IPC_CHANNELS.navigation.reload,
    IPC_CHANNELS.navigation.stop,
    IPC_CHANNELS.navigation.navigate,
    IPC_CHANNELS.window.minimize,
    IPC_CHANNELS.window.toggleMaximize,
    IPC_CHANNELS.window.close,
    IPC_CHANNELS.window.newWindow,
    IPC_CHANNELS.memorySaver.setSettings,
    IPC_CHANNELS.downloads.getSnapshot,
    IPC_CHANNELS.performance.metrics,
    ...DOWNLOAD_ACTIONS.map((action) => IPC_CHANNELS.downloads[action]),
  ]
  for (const channel of channels) ipcMain.removeHandler(channel)
}

function contextFor(event: IpcMainInvokeEvent): BrowserIpcContext {
  const context = contexts.get(event.sender.id)
  if (!context) throw new Error(`Photon IPC request from unknown sender ${event.sender.id}`)
  return context
}

export function sendOmniboxFocus(chromeWebContents: WebContents): void {
  if (!chromeWebContents.isDestroyed()) chromeWebContents.send(IPC_CHANNELS.focusOmnibox)
}
