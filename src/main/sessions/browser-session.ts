import {
  session,
  type Event,
  type WebContents,
  type WebContentsWillNavigateEventParams,
  type WebPreferences,
} from "electron"
import type { TabId } from "@/preload/photon-api"

type CreateTab = (url: string) => TabId

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
    guest.setWindowOpenHandler((details) => {
      if (isWebUrl(details.url)) createTab(details.url)
      return { action: "deny" }
    })
    guest.on("will-navigate", handleWillNavigate)
    guest.once("destroyed", () => guest.off("will-navigate", handleWillNavigate))
  }

  const denyPermissionCheck = (): boolean => false
  const denyPermissionRequest = (
    _webContents: WebContents,
    _permission: string,
    callback: (allowed: boolean) => void,
  ): void => {
    callback(false)
  }

  chromeWebContents.on("will-attach-webview", handleWillAttachWebview)
  chromeWebContents.on("did-attach-webview", handleDidAttachWebview)
  session.defaultSession.setPermissionCheckHandler(denyPermissionCheck)
  session.defaultSession.setPermissionRequestHandler(denyPermissionRequest)

  return () => {
    chromeWebContents.off("will-attach-webview", handleWillAttachWebview)
    chromeWebContents.off("did-attach-webview", handleDidAttachWebview)
    session.defaultSession.setPermissionCheckHandler(null)
    session.defaultSession.setPermissionRequestHandler(null)
  }
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
