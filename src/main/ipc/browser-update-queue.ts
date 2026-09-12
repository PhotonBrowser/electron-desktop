import type { WebContents } from "electron"
import { IPC_CHANNELS } from "../../shared/ipc-channels.ts"
import type { PhotonBrowserUpdate, PhotonBrowserUpdateEnvelope } from "@/shared/photon-api"

const UPDATE_FLUSH_DELAY_MS = 16

export interface BrowserUpdateQueue {
  getRevision: () => number
  enqueue: (update: PhotonBrowserUpdate) => void
  dispose: () => void
}

export function createBrowserUpdateQueue(chromeWebContents: WebContents): BrowserUpdateQueue {
  let revision = 0
  const pendingUpdates = new Map<string, PhotonBrowserUpdateEnvelope[]>()
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const flush = (): void => {
    flushTimer = undefined
    if (disposed) return

    const updates = [...pendingUpdates.values()]
      .flat()
      .sort((first, second) => first.revision - second.revision)
    pendingUpdates.clear()
    if (updates.length === 0 || chromeWebContents.isDestroyed()) return
    chromeWebContents.send(IPC_CHANNELS.browser.updates, updates)
  }

  const enqueue = (update: PhotonBrowserUpdate): void => {
    if (disposed) return

    const envelope = { revision: ++revision, update }
    const key = getUpdateKey(update)
    const pendingForKey = pendingUpdates.get(key) ?? []
    const previous = pendingForKey.at(-1)

    if (previous?.update.type === "tab-updated" && update.type === "tab-updated") {
      pendingForKey[pendingForKey.length - 1] = {
        revision: envelope.revision,
        update: {
          type: "tab-updated",
          tabId: update.tabId,
          changes: { ...previous.update.changes, ...update.changes },
        },
      }
    } else {
      pendingForKey.push(envelope)
    }

    pendingUpdates.set(key, pendingForKey)
    if (flushTimer !== undefined) return
    flushTimer = setTimeout(flush, UPDATE_FLUSH_DELAY_MS)
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    if (flushTimer !== undefined) clearTimeout(flushTimer)
    flushTimer = undefined
    pendingUpdates.clear()
  }

  return { getRevision: () => revision, enqueue, dispose }
}

function getUpdateKey(update: PhotonBrowserUpdate): string {
  if (update.type === "tab-added") return `tab:${update.tab.id}`
  if (update.type === "tab-updated") return `tab:${update.tabId}`
  if (update.type === "tab-removed") return `tab:${update.tabId}`
  if (update.type === "tabs-reordered") return "tabs-order"
  if (update.type === "active-tab-changed") return "active-tab"
  return "window-maximized"
}
