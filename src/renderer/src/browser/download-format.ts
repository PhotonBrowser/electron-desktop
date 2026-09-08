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
