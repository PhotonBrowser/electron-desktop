import type { BrowserDownload } from "@/shared/photon-api"

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes
  let unitIndex = -1
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 10 || Number.isInteger(value) ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

export function getDownloadProgress(download: BrowserDownload): number | null {
  if (download.totalBytes === null || download.totalBytes <= 0) return null
  if (!Number.isFinite(download.receivedBytes) || download.receivedBytes < 0) return 0
  return Math.min(1, download.receivedBytes / download.totalBytes)
}

export function sortDownloads(downloads: readonly BrowserDownload[]): BrowserDownload[] {
  return [...downloads].sort((left, right) => right.startedAt - left.startedAt)
}

export function isActiveDownload(download: BrowserDownload): boolean {
  return (
    download.state === "starting" || download.state === "progressing" || download.state === "paused"
  )
}
