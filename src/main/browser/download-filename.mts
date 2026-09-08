import { basename, parse } from "node:path"

export function sanitizeDownloadFilename(suggested: string): string {
  const name = basename(suggested.replaceAll("\\", "/").replaceAll("\0", "")).trim()
  return name && name !== "." && name !== ".." ? name : "download"
}

export function nextAvailableFilename(
  suggested: string,
  exists: (filename: string) => boolean,
): string {
  const filename = sanitizeDownloadFilename(suggested)
  if (!exists(filename)) return filename
  const { name, ext } = parse(filename)
  for (let index = 1; ; index += 1) {
    const candidate = `${name} (${index})${ext}`
    if (!exists(candidate)) return candidate
  }
}

export function downloadProgress(receivedBytes: number, totalBytes: number | null): number | null {
  if (totalBytes === null || totalBytes <= 0) return null
  return Math.min(1, receivedBytes / totalBytes)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = -1
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 ? 0 : 1).replace(/\.0$/, "")} ${units[unit]}`
}
