import { useCallback, useEffect, useRef, useState } from "react"
import type { BrowserDownload } from "@/shared/photon-api"
import { isActiveDownload, sortDownloads } from "../downloads.utils"
import type { DownloadsActions } from "../downloads.types"

export interface DownloadsState {
  downloads: BrowserDownload[]
  activeCount: number
  clearCompleted: () => void
  actions: DownloadsActions
}

export function useDownloads(): DownloadsState {
  const [downloads, setDownloads] = useState<BrowserDownload[]>([])
  const [hiddenIds, setHiddenIds] = useState<Set<BrowserDownload["id"]>>(() => new Set())
  const receivedLiveUpdate = useRef(false)

  useEffect(() => {
    const unsubscribe = window.photon.downloads.onChanged((next) => {
      receivedLiveUpdate.current = true
      setDownloads(sortDownloads(next))
    })
    void window.photon.downloads.getSnapshot().then((snapshot) => {
      if (!receivedLiveUpdate.current) setDownloads(sortDownloads(snapshot))
    })
    return unsubscribe
  }, [])

  const clearCompleted = useCallback(() => {
    setHiddenIds((current) => {
      const next = new Set(current)
      for (const download of downloads) {
        if (
          download.state === "completed" ||
          download.state === "cancelled" ||
          download.state === "interrupted"
        ) {
          next.add(download.id)
        }
      }
      return next
    })
  }, [downloads])

  const visibleDownloads = downloads.filter((download) => !hiddenIds.has(download.id))
  return {
    downloads: visibleDownloads,
    activeCount: visibleDownloads.filter(isActiveDownload).length,
    clearCompleted,
    actions: window.photon.downloads,
  }
}
