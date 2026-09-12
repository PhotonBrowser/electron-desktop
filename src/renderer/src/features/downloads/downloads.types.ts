import type { BrowserDownload } from "@/shared/photon-api"

export interface DownloadsActions {
  pause: (id: BrowserDownload["id"]) => Promise<void>
  resume: (id: BrowserDownload["id"]) => Promise<void>
  cancel: (id: BrowserDownload["id"]) => Promise<void>
  open: (id: BrowserDownload["id"]) => Promise<void>
  showInFolder: (id: BrowserDownload["id"]) => Promise<void>
}
