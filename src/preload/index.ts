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
} from "./photon-api"

const UPDATES_CHANNEL = "photon:browser-updates"
const FOCUS_OMNIBOX_CHANNEL = "photon:focus-omnibox"
const DOWNLOADS_CHANGED_CHANNEL = "photon:downloads-changed"
const NAVIGATION_COMMAND_CHANNEL = "photon:navigation-command"

const navigation: PhotonAPI["navigation"] = {
  back: () => ipcRenderer.invoke("photon:navigation:back") as Promise<void>,
  forward: () => ipcRenderer.invoke("photon:navigation:forward") as Promise<void>,
  reload: () => ipcRenderer.invoke("photon:navigation:reload") as Promise<void>,
  stop: () => ipcRenderer.invoke("photon:navigation:stop") as Promise<void>,
  navigate: (url) => ipcRenderer.invoke("photon:navigation:navigate", url) as Promise<void>,
}

const tabs: PhotonAPI["tabs"] = {
  create: () => ipcRenderer.invoke("photon:tabs:create") as Promise<TabId>,
  select: (tabId) => ipcRenderer.invoke("photon:tabs:select", tabId) as Promise<void>,
  close: (tabId) => ipcRenderer.invoke("photon:tabs:close", tabId) as Promise<void>,
  reorder: (tabIds) => ipcRenderer.invoke("photon:tabs:reorder", tabIds) as Promise<void>,
  update: (tabId: TabId, changes: PhotonWebviewEventChanges) =>
    ipcRenderer.invoke("photon:tabs:update", tabId, changes) as Promise<void>,
}

const windowAPI: PhotonAPI["window"] = {
  minimize: () => ipcRenderer.invoke("photon:window:minimize") as Promise<void>,
  toggleMaximize: () => ipcRenderer.invoke("photon:window:toggle-maximize") as Promise<void>,
  close: () => ipcRenderer.invoke("photon:window:close") as Promise<void>,
}

const memorySaver: PhotonAPI["memorySaver"] = {
  setSettings: (settings: MemorySaverSettings) =>
    ipcRenderer.invoke("photon:memory-saver:set-settings", settings) as Promise<void>,
}

const downloads: PhotonAPI["downloads"] = {
  getSnapshot: () =>
    ipcRenderer.invoke("photon:downloads:get-snapshot") as Promise<BrowserDownload[]>,
  cancel: (id: DownloadId) => ipcRenderer.invoke("photon:downloads:cancel", id) as Promise<void>,
  pause: (id: DownloadId) => ipcRenderer.invoke("photon:downloads:pause", id) as Promise<void>,
  resume: (id: DownloadId) => ipcRenderer.invoke("photon:downloads:resume", id) as Promise<void>,
  open: (id: DownloadId) => ipcRenderer.invoke("photon:downloads:open", id) as Promise<void>,
  showInFolder: (id: DownloadId) =>
    ipcRenderer.invoke("photon:downloads:showInFolder", id) as Promise<void>,
  onChanged: (listener) => {
    const handleChanged = (_event: Electron.IpcRendererEvent, next: BrowserDownload[]): void =>
      listener(next)
    ipcRenderer.on(DOWNLOADS_CHANGED_CHANNEL, handleChanged)
    return () => ipcRenderer.off(DOWNLOADS_CHANGED_CHANNEL, handleChanged)
  },
}

const performanceAPI: PhotonAPI["performance"] = {
  getMetrics: () =>
    ipcRenderer.invoke("photon:performance:metrics") as Promise<PhotonPerformanceMetrics>,
}

const photonAPI: PhotonAPI = {
  getSnapshot: () => ipcRenderer.invoke("photon:browser:get-snapshot") as Promise<PhotonSnapshot>,
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

    ipcRenderer.on(UPDATES_CHANNEL, handleUpdates)
    return () => ipcRenderer.off(UPDATES_CHANNEL, handleUpdates)
  },
  onFocusOmnibox: (listener) => {
    const handleFocus = (): void => listener()
    ipcRenderer.on(FOCUS_OMNIBOX_CHANNEL, handleFocus)
    return () => ipcRenderer.off(FOCUS_OMNIBOX_CHANNEL, handleFocus)
  },
  onNavigationCommand: (listener) => {
    const handleCommand = (
      _event: Electron.IpcRendererEvent,
      tabId: TabId,
      command: BrowserNavigationCommand,
    ): void => listener(tabId, command)
    ipcRenderer.on(NAVIGATION_COMMAND_CHANNEL, handleCommand)
    return () => ipcRenderer.off(NAVIGATION_COMMAND_CHANNEL, handleCommand)
  },
}

contextBridge.exposeInMainWorld("photon", photonAPI)
