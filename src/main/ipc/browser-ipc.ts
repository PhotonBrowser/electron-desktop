import { app, ipcMain, type BaseWindow, type WebContents } from "electron"
import type {
  DownloadId,
  MemorySaverSettings,
  PhotonBrowserUpdateEnvelope,
  PhotonPerformanceMetrics,
  PhotonSnapshot,
  PhotonWebviewEventChanges,
  TabId,
} from "@/preload/photon-api"
import type { TabManager } from "../browser/tab-manager"
import type { DownloadManager } from "../browser/download-manager.mts"
import { collectMetrics } from "../performance/metrics-collector"

export const UPDATES_CHANNEL = "photon:browser-updates"
export const FOCUS_OMNIBOX_CHANNEL = "photon:focus-omnibox"
export const NAVIGATION_COMMAND_CHANNEL = "photon:navigation-command"

interface BrowserIpcContext {
  browserWindow: BaseWindow
  chromeWebContents: WebContents
  tabManager: TabManager
  getSnapshot: () => PhotonSnapshot
  downloadManager: DownloadManager
}

function isTabIdList(value: unknown): value is TabId[] {
  return Array.isArray(value) && value.every((tabId): tabId is TabId => typeof tabId === "string")
}

function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && /^tab-\d+$/.test(value)
}

function isWebviewEventChanges(value: unknown): value is PhotonWebviewEventChanges {
  if (typeof value !== "object" || value === null) return false
  const changes = value as Record<string, unknown>
  const stringOrUndefined = (key: string): boolean =>
    changes[key] === undefined || typeof changes[key] === "string"
  const booleanOrUndefined = (key: string): boolean =>
    changes[key] === undefined || typeof changes[key] === "boolean"
  const nullableStringOrUndefined = (key: string): boolean =>
    changes[key] === undefined || changes[key] === null || typeof changes[key] === "string"

  return (
    stringOrUndefined("url") &&
    stringOrUndefined("title") &&
    nullableStringOrUndefined("faviconUrl") &&
    booleanOrUndefined("loading") &&
    booleanOrUndefined("canGoBack") &&
    booleanOrUndefined("canGoForward") &&
    booleanOrUndefined("crashed") &&
    nullableStringOrUndefined("error")
  )
}

function isDownloadId(value: unknown): value is DownloadId {
  return typeof value === "string" && /^download-\d+$/.test(value)
}

function isMemorySaverSettings(value: unknown): value is MemorySaverSettings {
  if (typeof value !== "object" || value === null) return false
  const settings = value as Partial<Record<keyof MemorySaverSettings, unknown>>
  return (
    typeof settings.enabled === "boolean" &&
    (settings.level === "moderate" || settings.level === "balanced" || settings.level === "maximum")
  )
}

export function registerBrowserIpc(context: BrowserIpcContext): void {
  const { browserWindow, chromeWebContents, tabManager, getSnapshot, downloadManager } = context

  ipcMain.handle("photon:browser:get-snapshot", () => getSnapshot())
  ipcMain.handle("photon:tabs:create", () => tabManager.createTab())
  ipcMain.handle("photon:tabs:select", (_event, tabId: TabId) => tabManager.selectTab(tabId))
  ipcMain.handle("photon:tabs:close", (_event, tabId: TabId) => tabManager.closeTab(tabId))
  ipcMain.handle("photon:tabs:reorder", (_event, tabIds: unknown) => {
    if (isTabIdList(tabIds)) tabManager.reorderTabs(tabIds)
  })
  ipcMain.handle("photon:tabs:update", (event, tabId: unknown, changes: unknown) => {
    if (event.sender !== chromeWebContents || !isTabId(tabId) || !isWebviewEventChanges(changes))
      return
    tabManager.updateFromWebview(tabId, changes)
  })
  ipcMain.handle("photon:navigation:back", () => tabManager.back())
  ipcMain.handle("photon:navigation:forward", () => tabManager.forward())
  ipcMain.handle("photon:navigation:reload", () => tabManager.reload())
  ipcMain.handle("photon:navigation:stop", () => tabManager.stopLoading())
  ipcMain.handle("photon:navigation:navigate", (_event, url: string) =>
    tabManager.navigateActive(url),
  )
  ipcMain.handle("photon:window:minimize", () => browserWindow.minimize())
  ipcMain.handle("photon:window:toggle-maximize", () => {
    if (browserWindow.isMaximized()) browserWindow.unmaximize()
    else browserWindow.maximize()
  })
  ipcMain.handle("photon:window:close", () => browserWindow.close())
  ipcMain.handle("photon:memory-saver:set-settings", (_event, settings: unknown) => {
    if (isMemorySaverSettings(settings)) tabManager.setMemorySaverSettings(settings)
  })
  ipcMain.handle("photon:downloads:get-snapshot", () => downloadManager.getSnapshot())
  if (!app.isPackaged) {
    ipcMain.handle("photon:performance:metrics", (): PhotonPerformanceMetrics =>
      collectMetrics(tabManager),
    )
  }
  for (const action of ["cancel", "pause", "resume", "open", "showInFolder"] as const) {
    ipcMain.handle(`photon:downloads:${action}`, (_event, id: unknown) => {
      if (!isDownloadId(id)) return
      return downloadManager[action](id)
    })
  }
}

export function sendBrowserUpdates(
  chromeWebContents: WebContents,
  updates: readonly PhotonBrowserUpdateEnvelope[],
): void {
  if (updates.length === 0 || chromeWebContents.isDestroyed()) return
  chromeWebContents.send(UPDATES_CHANNEL, updates)
}

export function sendOmniboxFocus(chromeWebContents: WebContents): void {
  if (!chromeWebContents.isDestroyed()) chromeWebContents.send(FOCUS_OMNIBOX_CHANNEL)
}

export function unregisterBrowserIpc(): void {
  ipcMain.removeHandler("photon:browser:get-snapshot")
  ipcMain.removeHandler("photon:tabs:create")
  ipcMain.removeHandler("photon:tabs:select")
  ipcMain.removeHandler("photon:tabs:close")
  ipcMain.removeHandler("photon:tabs:reorder")
  ipcMain.removeHandler("photon:tabs:update")
  ipcMain.removeHandler("photon:navigation:back")
  ipcMain.removeHandler("photon:navigation:forward")
  ipcMain.removeHandler("photon:navigation:reload")
  ipcMain.removeHandler("photon:navigation:stop")
  ipcMain.removeHandler("photon:navigation:navigate")
  ipcMain.removeHandler("photon:window:minimize")
  ipcMain.removeHandler("photon:window:toggle-maximize")
  ipcMain.removeHandler("photon:window:close")
  ipcMain.removeHandler("photon:memory-saver:set-settings")
  for (const action of ["cancel", "pause", "resume", "open", "showInFolder"] as const) {
    ipcMain.removeHandler(`photon:downloads:${action}`)
  }
  ipcMain.removeHandler("photon:downloads:get-snapshot")
  ipcMain.removeHandler("photon:performance:metrics")
}
