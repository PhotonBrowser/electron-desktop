import { contextBridge, ipcRenderer } from "electron"
import type { BrowserDownload, DownloadId, PhotonAPI, PhotonSnapshot, TabId } from "./photon-api"

const SNAPSHOT_CHANNEL = "photon:browser-snapshot"
const FOCUS_OMNIBOX_CHANNEL = "photon:focus-omnibox"
const DOWNLOADS_CHANGED_CHANNEL = "photon:downloads-changed"

const navigation: PhotonAPI["navigation"] = {
  back: () => ipcRenderer.invoke("photon:navigation:back") as Promise<void>,
  forward: () => ipcRenderer.invoke("photon:navigation:forward") as Promise<void>,
  reload: () => ipcRenderer.invoke("photon:navigation:reload") as Promise<void>,
  navigate: (url) => ipcRenderer.invoke("photon:navigation:navigate", url) as Promise<void>,
}

const tabs: PhotonAPI["tabs"] = {
  create: () => ipcRenderer.invoke("photon:tabs:create") as Promise<TabId>,
  select: (tabId) => ipcRenderer.invoke("photon:tabs:select", tabId) as Promise<void>,
  close: (tabId) => ipcRenderer.invoke("photon:tabs:close", tabId) as Promise<void>,
  reorder: (tabIds) => ipcRenderer.invoke("photon:tabs:reorder", tabIds) as Promise<void>,
}

const windowAPI: PhotonAPI["window"] = {
  minimize: () => ipcRenderer.invoke("photon:window:minimize") as Promise<void>,
  toggleMaximize: () => ipcRenderer.invoke("photon:window:toggle-maximize") as Promise<void>,
  close: () => ipcRenderer.invoke("photon:window:close") as Promise<void>,
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

const photonAPI: PhotonAPI = {
  getSnapshot: () => ipcRenderer.invoke("photon:browser:get-snapshot") as Promise<PhotonSnapshot>,
  navigation,
  tabs,
  window: windowAPI,
  downloads,
  onSnapshot: (listener) => {
    const handleSnapshot = (_event: Electron.IpcRendererEvent, snapshot: PhotonSnapshot): void =>
      listener(snapshot)

    ipcRenderer.on(SNAPSHOT_CHANNEL, handleSnapshot)
    return () => ipcRenderer.off(SNAPSHOT_CHANNEL, handleSnapshot)
  },
  onFocusOmnibox: (listener) => {
    const handleFocus = (): void => listener()
    ipcRenderer.on(FOCUS_OMNIBOX_CHANNEL, handleFocus)
    return () => ipcRenderer.off(FOCUS_OMNIBOX_CHANNEL, handleFocus)
  },
}

contextBridge.exposeInMainWorld("photon", photonAPI)
