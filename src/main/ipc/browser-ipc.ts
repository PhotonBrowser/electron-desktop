import { app, ipcMain, type BrowserWindow } from "electron"
import {
  OVERLAY_HIDDEN_CHANNEL,
  OVERLAY_HIDE_CHANNEL,
  OVERLAY_SHOW_SITE_SECURITY_CHANNEL,
  type OverlayBounds,
} from "@/shared/overlay"
import type { SiteSecurity } from "@/shared/site-security"
import type {
  DownloadId,
  MemorySaverSettings,
  PhotonBrowserUpdateEnvelope,
  PhotonPerformanceMetrics,
  PhotonSnapshot,
  TabId,
} from "@/preload/photon-api"
import type { TabManager } from "../browser/tab-manager"
import type { DownloadManager } from "../browser/download-manager.mts"
import type { WindowComposition } from "../window/window-composition"
import { collectMetrics } from "../performance/metrics-collector"

export const UPDATES_CHANNEL = "photon:browser-updates"
export const FOCUS_OMNIBOX_CHANNEL = "photon:focus-omnibox"

interface BrowserIpcContext {
  browserWindow: BrowserWindow
  tabManager: TabManager
  getSnapshot: () => PhotonSnapshot
  downloadManager: DownloadManager
  composition: WindowComposition
}

function isTabIdList(value: unknown): value is TabId[] {
  return Array.isArray(value) && value.every((tabId): tabId is TabId => typeof tabId === "string")
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

function isOverlayBounds(value: unknown): value is OverlayBounds {
  if (typeof value !== "object" || value === null) return false
  const bounds = value as Partial<Record<keyof OverlayBounds, unknown>>
  return (
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    typeof bounds.width === "number" &&
    typeof bounds.height === "number" &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0
  )
}

function isSiteSecurity(value: unknown): value is SiteSecurity {
  if (typeof value !== "object" || value === null) return false
  const site = value as Partial<Record<keyof SiteSecurity, unknown>>
  return typeof site.host === "string" && typeof site.isSecure === "boolean"
}

export function registerBrowserIpc(context: BrowserIpcContext): void {
  const { browserWindow, tabManager, getSnapshot, downloadManager, composition } = context

  ipcMain.handle("photon:browser:get-snapshot", () => getSnapshot())
  ipcMain.handle("photon:tabs:create", () => tabManager.createTab())
  ipcMain.handle("photon:tabs:select", (_event, tabId: TabId) => tabManager.selectTab(tabId))
  ipcMain.handle("photon:tabs:close", (_event, tabId: TabId) => tabManager.closeTab(tabId))
  ipcMain.handle("photon:tabs:reorder", (_event, tabIds: unknown) => {
    if (isTabIdList(tabIds)) tabManager.reorderTabs(tabIds)
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
  ipcMain.handle(OVERLAY_SHOW_SITE_SECURITY_CHANNEL, (_event, bounds: unknown, site: unknown) => {
    if (!isOverlayBounds(bounds) || !isSiteSecurity(site)) return
    composition.showOverlay({
      kind: "browser",
      bounds,
      state: { kind: "site-security", site },
    })
    composition.focusOverlay()
  })
  ipcMain.handle(OVERLAY_HIDE_CHANNEL, () => {
    composition.hideOverlay("browser")
    if (!browserWindow.webContents.isDestroyed()) {
      browserWindow.webContents.send(OVERLAY_HIDDEN_CHANNEL)
    }
  })
  for (const action of ["cancel", "pause", "resume", "open", "showInFolder"] as const) {
    ipcMain.handle(`photon:downloads:${action}`, (_event, id: unknown) => {
      if (!isDownloadId(id)) return
      return downloadManager[action](id)
    })
  }
}

export function sendBrowserUpdates(
  browserWindow: BrowserWindow,
  updates: readonly PhotonBrowserUpdateEnvelope[],
): void {
  if (updates.length === 0 || browserWindow.webContents.isDestroyed()) return
  browserWindow.webContents.send(UPDATES_CHANNEL, updates)
}

export function sendOmniboxFocus(browserWindow: BrowserWindow): void {
  if (browserWindow.isDestroyed()) return
  const { webContents } = browserWindow
  if (!webContents.isDestroyed()) {
    webContents.send(FOCUS_OMNIBOX_CHANNEL)
  }
}

export function unregisterBrowserIpc(): void {
  ipcMain.removeHandler("photon:browser:get-snapshot")
  ipcMain.removeHandler("photon:tabs:create")
  ipcMain.removeHandler("photon:tabs:select")
  ipcMain.removeHandler("photon:tabs:close")
  ipcMain.removeHandler("photon:tabs:reorder")
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
  ipcMain.removeHandler(OVERLAY_SHOW_SITE_SECURITY_CHANNEL)
  ipcMain.removeHandler(OVERLAY_HIDE_CHANNEL)
}
