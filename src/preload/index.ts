import { contextBridge, ipcRenderer } from "electron"
import type {
  BrowserNavigationCommand,
  BrowserDownload,
  DownloadId,
  MemorySaverSettings,
  PhotonBrowserUpdateEnvelope,
  PhotonAPI,
  PhotonPerformanceMetrics,
  PhotonSnapshot,
  PhotonWebviewEventChanges,
  TabId,
} from "@/shared/photon-api"
import { IPC_CHANNELS } from "@/shared/ipc-channels"

function invoke<TResult>(channel: string, ...args: readonly unknown[]): Promise<TResult> {
  return ipcRenderer.invoke(channel, ...args) as Promise<TResult>
}

const navigation: PhotonAPI["navigation"] = {
  back: () => invoke<void>(IPC_CHANNELS.navigation.back),
  forward: () => invoke<void>(IPC_CHANNELS.navigation.forward),
  reload: () => invoke<void>(IPC_CHANNELS.navigation.reload),
  stop: () => invoke<void>(IPC_CHANNELS.navigation.stop),
  navigate: (url) => invoke<void>(IPC_CHANNELS.navigation.navigate, url),
}

const tabs: PhotonAPI["tabs"] = {
  create: () => invoke<TabId>(IPC_CHANNELS.tabs.create),
  select: (tabId) => invoke<void>(IPC_CHANNELS.tabs.select, tabId),
  close: (tabId) => invoke<void>(IPC_CHANNELS.tabs.close, tabId),
  reorder: (tabIds) => invoke<void>(IPC_CHANNELS.tabs.reorder, tabIds),
  update: (tabId: TabId, changes: PhotonWebviewEventChanges) =>
    invoke<void>(IPC_CHANNELS.tabs.update, tabId, changes),
}

const windowAPI: PhotonAPI["window"] = {
  minimize: () => invoke<void>(IPC_CHANNELS.window.minimize),
  toggleMaximize: () => invoke<void>(IPC_CHANNELS.window.toggleMaximize),
  close: () => invoke<void>(IPC_CHANNELS.window.close),
  newWindow: () => invoke<void>(IPC_CHANNELS.window.newWindow),
}

const memorySaver: PhotonAPI["memorySaver"] = {
  setSettings: (settings: MemorySaverSettings) =>
    invoke<void>(IPC_CHANNELS.memorySaver.setSettings, settings),
}

const downloads: PhotonAPI["downloads"] = {
  getSnapshot: () => invoke<BrowserDownload[]>(IPC_CHANNELS.downloads.getSnapshot),
  cancel: (id: DownloadId) => invoke<void>(IPC_CHANNELS.downloads.cancel, id),
  pause: (id: DownloadId) => invoke<void>(IPC_CHANNELS.downloads.pause, id),
  resume: (id: DownloadId) => invoke<void>(IPC_CHANNELS.downloads.resume, id),
  open: (id: DownloadId) => invoke<void>(IPC_CHANNELS.downloads.open, id),
  showInFolder: (id: DownloadId) => invoke<void>(IPC_CHANNELS.downloads.showInFolder, id),
  onChanged: (listener) => {
    const handleChanged = (_event: Electron.IpcRendererEvent, next: BrowserDownload[]): void =>
      listener(next)
    ipcRenderer.on(IPC_CHANNELS.downloads.changed, handleChanged)
    return () => ipcRenderer.off(IPC_CHANNELS.downloads.changed, handleChanged)
  },
}

const performanceAPI: PhotonAPI["performance"] = {
  getMetrics: () => invoke<PhotonPerformanceMetrics>(IPC_CHANNELS.performance.metrics),
}

const photonAPI: PhotonAPI = {
  getSnapshot: () => invoke<PhotonSnapshot>(IPC_CHANNELS.browser.getSnapshot),
  navigation,
  tabs,
  window: windowAPI,
  memorySaver,
  downloads,
  performance: performanceAPI,
  onUpdates: (listener) => {
    const handleUpdates = (
      _event: Electron.IpcRendererEvent,
      updates: PhotonBrowserUpdateEnvelope[],
    ): void => listener(updates)

    ipcRenderer.on(IPC_CHANNELS.browser.updates, handleUpdates)
    return () => ipcRenderer.off(IPC_CHANNELS.browser.updates, handleUpdates)
  },
  onFocusOmnibox: (listener) => {
    const handleFocus = (): void => listener()
    ipcRenderer.on(IPC_CHANNELS.focusOmnibox, handleFocus)
    return () => ipcRenderer.off(IPC_CHANNELS.focusOmnibox, handleFocus)
  },
  onNavigationCommand: (listener) => {
    const handleCommand = (
      _event: Electron.IpcRendererEvent,
      tabId: TabId,
      command: BrowserNavigationCommand,
    ): void => listener(tabId, command)
    ipcRenderer.on(IPC_CHANNELS.navigation.command, handleCommand)
    return () => ipcRenderer.off(IPC_CHANNELS.navigation.command, handleCommand)
  },
}

contextBridge.exposeInMainWorld("photon", photonAPI)
