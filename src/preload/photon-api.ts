export type TabId = string & { readonly __tabId: unique symbol }
export type DownloadId = string & { readonly __downloadId: unique symbol }
export type MemorySaverLevel = "moderate" | "balanced" | "maximum"

export interface MemorySaverSettings {
  enabled: boolean
  level: MemorySaverLevel
}

export type DownloadState =
  "starting" | "progressing" | "paused" | "completed" | "cancelled" | "interrupted"

export interface BrowserDownload {
  id: DownloadId
  filename: string
  sourceUrl: string
  receivedBytes: number
  totalBytes: number | null
  state: DownloadState
  startedAt: number
  completedAt?: number
}

export interface BrowserTab {
  id: TabId
  kind: "internal" | "web"
  internalPage: "new-tab" | "settings" | null
  showInUrlBar: boolean
  url: string
  title: string
  faviconUrl?: string
  loading: boolean
  lifecycleState: "active" | "frozen"
  canGoBack: boolean
  canGoForward: boolean
}

export interface PhotonSnapshot {
  revision: number
  tabs: BrowserTab[]
  activeTabId: TabId
  isMaximized: boolean
}

export interface BrowserTabChanges {
  kind?: BrowserTab["kind"]
  internalPage?: BrowserTab["internalPage"]
  showInUrlBar?: boolean
  url?: string
  title?: string
  faviconUrl?: string | null
  loading?: boolean
  lifecycleState?: BrowserTab["lifecycleState"]
  canGoBack?: boolean
  canGoForward?: boolean
}

export type PhotonBrowserUpdate =
  | { type: "tab-added"; tab: BrowserTab }
  | { type: "tab-updated"; tabId: TabId; changes: BrowserTabChanges }
  | { type: "tab-removed"; tabId: TabId }
  | { type: "tabs-reordered"; tabIds: TabId[] }
  | { type: "active-tab-changed"; activeTabId: TabId }
  | { type: "window-maximized-changed"; isMaximized: boolean }

export interface PhotonBrowserUpdateEnvelope {
  revision: number
  update: PhotonBrowserUpdate
}

export interface PhotonNavigationAPI {
  back: () => Promise<void>
  forward: () => Promise<void>
  reload: () => Promise<void>
  stop: () => Promise<void>
  navigate: (url: string) => Promise<void>
}

export interface PhotonTabsAPI {
  create: () => Promise<TabId>
  select: (tabId: TabId) => Promise<void>
  close: (tabId: TabId) => Promise<void>
  reorder: (tabIds: TabId[]) => Promise<void>
}

export interface PhotonWindowAPI {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
}

export interface PhotonMemorySaverAPI {
  setSettings: (settings: MemorySaverSettings) => Promise<void>
}

export interface PhotonDownloadsAPI {
  getSnapshot: () => Promise<BrowserDownload[]>
  cancel: (id: DownloadId) => Promise<void>
  pause: (id: DownloadId) => Promise<void>
  resume: (id: DownloadId) => Promise<void>
  open: (id: DownloadId) => Promise<void>
  showInFolder: (id: DownloadId) => Promise<void>
  onChanged: (listener: (downloads: BrowserDownload[]) => void) => () => void
}

export interface PhotonPerformanceMetrics {
  cpuPercent: number
  ramTotalBytes: number
  ramHeapUsedBytes: number
  rendererCount: number
  webContentsCount: number
  totalWorkingSetBytes: number
  totalPrivateBytes: number | null
  processes: PhotonProcessMetric[]
  activeTabId: TabId | null
  tabs: PhotonTabDiagnostics[]
  timestamp: number
}

export interface PhotonProcessMetric {
  type: string
  name: string | null
  pid: number
  cpuPercent: number
  workingSetBytes: number
  privateBytes: number | null
  webContents: PhotonWebContentsMetric[]
}

export interface PhotonWebContentsMetric {
  id: number
  type: string
  url: string
  title: string
}

export interface PhotonTabDiagnostics {
  tabId: TabId
  pageRendererInitialized: boolean
  pageWebContentsId: number | null
  pageProcessId: number | null
}

export interface PhotonPerformanceAPI {
  getMetrics: () => Promise<PhotonPerformanceMetrics>
}

export interface PhotonAPI {
  getSnapshot: () => Promise<PhotonSnapshot>
  navigation: PhotonNavigationAPI
  tabs: PhotonTabsAPI
  window: PhotonWindowAPI
  memorySaver: PhotonMemorySaverAPI
  downloads: PhotonDownloadsAPI
  performance: PhotonPerformanceAPI
  overlay: PhotonOverlayAPI
  onUpdates: (listener: (updates: PhotonBrowserUpdateEnvelope[]) => void) => () => void
  onFocusOmnibox: (listener: () => void) => () => void
}
import type { PhotonOverlayAPI } from "@/shared/overlay"
