import {
  session,
  type Event,
  type WebContents,
  type WebContentsWillNavigateEventParams,
  type WebPreferences,
} from "electron"
import type { TabId } from "@/shared/photon-api"
import { WEBVIEW_EVENTS } from "@/shared/webview-events"
import { showBrowserContextMenu } from "./browser-context-menu"

type CreateTab = (url: string, focusOmnibox: boolean) => TabId
let configuredSessionCount = 0

const denyPermissionCheck = (): boolean => false
const denyPermissionRequest = (
  _webContents: WebContents,
  _permission: string,
  callback: (allowed: boolean) => void,
): void => {
  callback(false)
}

/**
 * Applies the security and guest-window policy shared by every Photon webview.
 * Guest pages never receive the Photon preload or a privileged IPC surface.
 */
export function configureBrowserSession(
  chromeWebContents: WebContents,
  createTab: CreateTab,
): () => void {
  // Webviews omit a partition on purpose, so all tabs use Electron's shared
  // persistent default session (and the existing download listener).
  const handleWillAttachWebview = (
    event: Event,
    webPreferences: WebPreferences,
    params: Record<string, string>,
  ): void => {
    if (!isWebUrl(params.src ?? "")) {
      event.preventDefault()
      return
    }

    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    delete webPreferences.preload
    delete params.preload
  }

  const handleDidAttachWebview = (_event: Event, guest: WebContents): void => {
    const handleWillNavigate = (details: Event<WebContentsWillNavigateEventParams>): void => {
      if (!isWebUrl(details.url)) details.preventDefault()
    }
    const handleContextMenu = (_event: Event, params: Electron.ContextMenuParams): void => {
      showBrowserContextMenu(guest, params)
    }
    guest.setWindowOpenHandler((details) => {
      if (isWebUrl(details.url)) createTab(details.url, false)
      return { action: "deny" }
    })
    guest.on(WEBVIEW_EVENTS.willNavigate, handleWillNavigate)
    guest.on("context-menu", handleContextMenu)
    guest.once("destroyed", () => {
      guest.off(WEBVIEW_EVENTS.willNavigate, handleWillNavigate)
      guest.off("context-menu", handleContextMenu)
    })
  }

  chromeWebContents.on(WEBVIEW_EVENTS.willAttach, handleWillAttachWebview)
  chromeWebContents.on(WEBVIEW_EVENTS.didAttach, handleDidAttachWebview)
  if (configuredSessionCount === 0) {
    session.defaultSession.setPermissionCheckHandler(denyPermissionCheck)
    session.defaultSession.setPermissionRequestHandler(denyPermissionRequest)
  }
  configuredSessionCount += 1
  let disposed = false

  return () => {
    if (disposed) return
    disposed = true
    chromeWebContents.off(WEBVIEW_EVENTS.willAttach, handleWillAttachWebview)
    chromeWebContents.off(WEBVIEW_EVENTS.didAttach, handleDidAttachWebview)
    configuredSessionCount -= 1
    if (configuredSessionCount === 0) {
      session.defaultSession.setPermissionCheckHandler(null)
      session.defaultSession.setPermissionRequestHandler(null)
    }
  }
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
