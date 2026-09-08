export const CHROME_LAYOUT = {
  titlebarHeight: 36,
  toolbarHeight: 36,
  contentTop: 72,
  contentInset: 4,
  contentRadius: 4,
} as const

export type TabId = string & { readonly __tabId: unique symbol }
export type DownloadId = string & { readonly __downloadId: unique symbol }

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
  canGoBack: boolean
  canGoForward: boolean
}

export interface PhotonSnapshot {
  tabs: BrowserTab[]
  activeTabId: TabId
  isMaximized: boolean
}

export interface PhotonNavigationAPI {
  back: () => Promise<void>
  forward: () => Promise<void>
  reload: () => Promise<void>
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

export interface PhotonDownloadsAPI {
  getSnapshot: () => Promise<BrowserDownload[]>
  cancel: (id: DownloadId) => Promise<void>
  pause: (id: DownloadId) => Promise<void>
  resume: (id: DownloadId) => Promise<void>
  open: (id: DownloadId) => Promise<void>
  showInFolder: (id: DownloadId) => Promise<void>
  onChanged: (listener: (downloads: BrowserDownload[]) => void) => () => void
}

export interface PhotonAPI {
  getSnapshot: () => Promise<PhotonSnapshot>
  navigation: PhotonNavigationAPI
  tabs: PhotonTabsAPI
  window: PhotonWindowAPI
  downloads: PhotonDownloadsAPI
  onSnapshot: (listener: (snapshot: PhotonSnapshot) => void) => () => void
  onFocusOmnibox: (listener: () => void) => () => void
}
