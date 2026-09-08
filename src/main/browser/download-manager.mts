import { app, session, shell, type BrowserWindow, type DownloadItem, type Event } from "electron"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { BrowserDownload, DownloadId } from "@/preload/photon-api"
import { nextAvailableFilename } from "./download-filename.mts"

type ChangeListener = () => void

interface DownloadRecord {
  state: BrowserDownload
  item?: DownloadItem | undefined
  savePath?: string
  progressTimer?: ReturnType<typeof setTimeout> | undefined
}

export class DownloadManager {
  private readonly browserWindow: BrowserWindow
  private readonly downloads = new Map<DownloadId, DownloadRecord>()
  private readonly reservedPaths = new Set<string>()
  private readonly listeners = new Set<ChangeListener>()
  private readonly downloadsDirectory = app.getPath("downloads")
  private nextId = 1
  private disposed = false
  private readonly handleWillDownload = (_event: Event, item: DownloadItem): void => {
    this.track(item)
  }

  constructor(browserWindow: BrowserWindow) {
    this.browserWindow = browserWindow
    session.defaultSession.on("will-download", this.handleWillDownload)
  }

  getSnapshot(): BrowserDownload[] {
    return [...this.downloads.values()]
      .map(({ state }) => state)
      .sort((left, right) => right.startedAt - left.startedAt)
  }

  onChanged(listener: ChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  cancel(id: DownloadId): void {
    const record = this.downloads.get(id)
    if (!record?.item || isTerminal(record.state.state)) return
    try {
      record.item.cancel()
      record.state = { ...record.state, state: "cancelled", completedAt: Date.now() }
      this.emit()
    } catch {
      // DownloadItem may terminate between validation and action.
    }
  }

  pause(id: DownloadId): void {
    const record = this.downloads.get(id)
    if (!record?.item || record.state.state !== "progressing" || !record.item.canResume()) return
    try {
      record.item.pause()
      record.state = { ...record.state, state: "paused" }
      this.emit()
    } catch {
      // DownloadItem may terminate between validation and action.
    }
  }

  resume(id: DownloadId): void {
    const record = this.downloads.get(id)
    if (!record?.item || record.state.state !== "paused" || !record.item.canResume()) return
    try {
      record.item.resume()
      record.state = { ...record.state, state: "progressing" }
      this.emit()
    } catch {
      // DownloadItem may terminate between validation and action.
    }
  }

  async open(id: DownloadId): Promise<void> {
    const path = this.downloads.get(id)?.savePath
    if (!path) return
    try {
      if (!existsSync(path)) return this.markMissing(id)
      if (await shell.openPath(path)) this.markMissing(id)
    } catch {
      this.markMissing(id)
    }
  }

  showInFolder(id: DownloadId): void {
    const path = this.downloads.get(id)?.savePath
    if (!path || !existsSync(path)) {
      if (path) this.markMissing(id)
      return
    }
    try {
      shell.showItemInFolder(path)
    } catch {
      this.markMissing(id)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    session.defaultSession.off("will-download", this.handleWillDownload)
    for (const record of this.downloads.values()) {
      if (record.progressTimer) clearTimeout(record.progressTimer)
    }
    this.listeners.clear()
  }

  private track(item: DownloadItem): void {
    const id = `download-${this.nextId++}` as DownloadId
    const filename = nextAvailableFilename(
      item.getFilename(),
      (candidate) =>
        existsSync(join(this.downloadsDirectory, candidate)) ||
        this.reservedPaths.has(join(this.downloadsDirectory, candidate)),
    )
    const savePath = join(this.downloadsDirectory, filename)
    this.reservedPaths.add(savePath)
    const record: DownloadRecord = {
      state: {
        id,
        filename,
        sourceUrl: item.getURL(),
        receivedBytes: 0,
        totalBytes: item.getTotalBytes() > 0 ? item.getTotalBytes() : null,
        state: "starting",
        startedAt: Date.now(),
      },
      item,
      savePath,
    }
    this.downloads.set(id, record)
    try {
      item.setSavePath(savePath)
    } catch {
      record.state = { ...record.state, state: "interrupted", completedAt: Date.now() }
      try {
        item.cancel()
      } catch {
        // DownloadItem may already be terminating.
      }
      record.item = undefined
      this.emit()
      return
    }
    item.on("updated", (_event, state) => {
      record.state = {
        ...record.state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes() > 0 ? item.getTotalBytes() : null,
        state: state === "progressing" ? "progressing" : "paused",
      }
      this.emitThrottled(record)
    })
    item.once("done", (_event, state) => {
      if (record.progressTimer) clearTimeout(record.progressTimer)
      record.state = {
        ...record.state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes: item.getTotalBytes() > 0 ? item.getTotalBytes() : record.state.totalBytes,
        state:
          state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted",
        completedAt: Date.now(),
      }
      record.item = undefined
      this.emit()
    })
    this.emit()
  }

  private emitThrottled(record: DownloadRecord): void {
    if (record.progressTimer) return
    record.progressTimer = setTimeout(() => {
      record.progressTimer = undefined
      this.emit()
    }, 75)
  }

  private markMissing(id: DownloadId): void {
    const record = this.downloads.get(id)
    if (!record || record.state.state !== "completed") return
    record.state = { ...record.state, state: "interrupted" }
    this.emit()
  }

  private emit(): void {
    if (this.disposed) return
    for (const listener of this.listeners) listener()
    if (!this.browserWindow.webContents.isDestroyed()) {
      this.browserWindow.webContents.send("photon:downloads-changed", this.getSnapshot())
    }
  }
}

function isTerminal(state: BrowserDownload["state"]): boolean {
  return state === "completed" || state === "cancelled" || state === "interrupted"
}
