import { app } from "electron"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { BrowserTab, TabId } from "@/preload/photon-api"
import { isValidTabUrl, type InternalPageRegistry } from "./internal-pages.mts"

const SESSION_VERSION = 1
const SESSION_FILE = "session.json"

export interface RestoredSession {
  tabs: Array<Pick<BrowserTab, "id" | "url">>
  activeTabId: TabId
}

export async function loadSession(
  pages: InternalPageRegistry,
): Promise<RestoredSession | undefined> {
  try {
    const data: unknown = JSON.parse(
      await readFile(join(app.getPath("userData"), SESSION_FILE), "utf8"),
    )
    if (!isSession(data)) throw new Error("unsupported session schema")
    const tabs = data.tabs.filter((tab) => isValidTabUrl(tab.url, pages))
    if (tabs.length === 0) return undefined
    const firstTab = tabs[0]
    if (!firstTab) return undefined
    const activeTabId = tabs.some((tab) => tab.id === data.activeTabId)
      ? data.activeTabId
      : firstTab.id
    return {
      tabs: tabs.map(({ id, url }) => ({ id: id as TabId, url })),
      activeTabId: activeTabId as TabId,
    }
  } catch (error) {
    const errorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : undefined
    if (errorCode !== "ENOENT" && process.env.NODE_ENV !== "production") {
      console.warn(
        "Ignoring Photon session: " + (error instanceof Error ? error.message : "unknown error"),
      )
    }
    return undefined
  }
}

export class SessionStore {
  private pending:
    { version: 1; activeTabId: string; tabs: Array<{ id: string; url: string }> } | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private writing: Promise<void> | undefined

  schedule(snapshot: { tabs: BrowserTab[]; activeTabId: TabId }): void {
    this.pending = {
      version: 1,
      activeTabId: snapshot.activeTabId,
      tabs: snapshot.tabs.map(({ id, url }) => ({ id, url })),
    }
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 250)
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    if (!this.pending) return this.writing ?? Promise.resolve()
    const session = this.pending
    this.pending = undefined
    const write = async (): Promise<void> => {
      const directory = app.getPath("userData")
      const temporaryPath = join(directory, SESSION_FILE + ".tmp")
      try {
        await mkdir(directory, { recursive: true })
        await writeFile(temporaryPath, JSON.stringify(session), "utf8")
        await rename(temporaryPath, join(directory, SESSION_FILE))
      } catch (error) {
        if (process.env.NODE_ENV !== "production")
          console.warn("Photon session write failed", error)
      }
    }
    this.writing = (this.writing ?? Promise.resolve()).then(write)
    await this.writing
    this.writing = undefined
  }
}

function isSession(
  value: unknown,
): value is { version: 1; activeTabId: string; tabs: Array<{ id: string; url: string }> } {
  if (!value || typeof value !== "object") return false
  const data = value as Record<string, unknown>
  if (
    data.version !== SESSION_VERSION ||
    typeof data.activeTabId !== "string" ||
    !Array.isArray(data.tabs)
  )
    return false
  const ids = new Set<string>()
  return data.tabs.every((tab): tab is { id: string; url: string } => {
    if (!tab || typeof tab !== "object") return false
    const item = tab as Record<string, unknown>
    if (
      typeof item.id !== "string" ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.url !== "string" ||
      !item.url
    )
      return false
    ids.add(item.id)
    return true
  })
}
