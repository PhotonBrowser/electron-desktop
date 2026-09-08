import { create } from "zustand"
import type { BrowserDownload } from "@/preload/photon-api"

interface DownloadsStore {
  downloads: BrowserDownload[]
  applyDownloads: (downloads: BrowserDownload[]) => void
}

export const useDownloadsStore = create<DownloadsStore>((set) => ({
  downloads: [],
  applyDownloads: (downloads) => set({ downloads }),
}))
