import type { Event, Input, WebContents } from "electron"
import { WEBVIEW_EVENTS } from "../../shared/webview-events.ts"
import type { TabManager } from "../browser/tab-manager"

export type BrowserShortcut =
  | "focus-omnibox"
  | "new-tab"
  | "reopen-tab"
  | "close-tab"
  | "reload"
  | "next-tab"
  | "previous-tab"
  | "back"
  | "forward"
  | "devtools"

interface BrowserShortcutsContext {
  chromeWebContents: WebContents
  tabManager: Pick<
    TabManager,
    | "back"
    | "closeActiveTab"
    | "createTab"
    | "forward"
    | "reload"
    | "reopenClosedTab"
    | "selectRelativeTab"
    | "toggleDevTools"
  >
  focusOmnibox: () => void
}

interface ShortcutInput {
  type: string
  key: string
  isAutoRepeat: boolean
  shift: boolean
  control: boolean
  alt: boolean
  meta: boolean
}

/**
 * Resolves browser commands before the focused web contents can dispatch them
 * to an untrusted page. The matcher deliberately requires an exact modifier
 * set so Ctrl+Shift+R, for example, remains a website command.
 */
export function resolveBrowserShortcut(input: ShortcutInput): BrowserShortcut | undefined {
  if (input.type !== "keyDown" || input.isAutoRepeat) return undefined

  const key = input.key.toLowerCase()
  const hasPrimaryModifier = process.platform === "darwin" ? input.meta : input.control
  const hasOtherPrimaryModifier = process.platform === "darwin" ? input.control : input.meta

  if (hasPrimaryModifier && !hasOtherPrimaryModifier && !input.shift && !input.alt) {
    if (key === "l") return "focus-omnibox"
    if (key === "t") return "new-tab"
    if (key === "w") return "close-tab"
    if (key === "r") return "reload"
    if (key === "tab") return "next-tab"
  }

  if (hasPrimaryModifier && !hasOtherPrimaryModifier && input.shift && !input.alt && key === "t") {
    return "reopen-tab"
  }

  if (
    hasPrimaryModifier &&
    !hasOtherPrimaryModifier &&
    input.shift &&
    !input.alt &&
    key === "tab"
  ) {
    return "previous-tab"
  }

  if (hasPrimaryModifier && !hasOtherPrimaryModifier && input.shift && !input.alt && key === "i") {
    return "devtools"
  }

  if (!hasPrimaryModifier && !hasOtherPrimaryModifier && !input.shift && input.alt) {
    if (key === "arrowleft" || key === "left") return "back"
    if (key === "arrowright" || key === "right") return "forward"
  }

  return undefined
}

export function registerBrowserShortcuts(context: BrowserShortcutsContext): () => void {
  const { tabManager, focusOmnibox } = context
  const attachedWebContents = new Set<WebContents>()
  const handleBeforeInputEvent = (event: Event, input: Input): void => {
    const shortcut = resolveBrowserShortcut(input)
    if (!shortcut) return

    event.preventDefault()
    switch (shortcut) {
      case "focus-omnibox":
        focusOmnibox()
        return
      case "new-tab":
        tabManager.createTab()
        return
      case "reopen-tab":
        tabManager.reopenClosedTab()
        return
      case "close-tab":
        tabManager.closeActiveTab()
        return
      case "reload":
        tabManager.reload()
        return
      case "next-tab":
        tabManager.selectRelativeTab(1)
        return
      case "previous-tab":
        tabManager.selectRelativeTab(-1)
        return
      case "back":
        tabManager.back()
        return
      case "forward":
        tabManager.forward()
        return
      case "devtools":
        tabManager.toggleDevTools()
        return
    }
  }
  const attach = (webContents: WebContents): void => {
    if (webContents.isDestroyed() || attachedWebContents.has(webContents)) return
    webContents.on("before-input-event", handleBeforeInputEvent)
    attachedWebContents.add(webContents)
  }

  const handleGuestAttached = (_event: Event, guest: WebContents): void => attach(guest)
  const { chromeWebContents } = context
  attach(chromeWebContents)
  chromeWebContents.on(WEBVIEW_EVENTS.didAttach, handleGuestAttached)

  return () => {
    chromeWebContents.off(WEBVIEW_EVENTS.didAttach, handleGuestAttached)
    for (const webContents of attachedWebContents) {
      webContents.off("before-input-event", handleBeforeInputEvent)
    }
    attachedWebContents.clear()
  }
}
