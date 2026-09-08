import type { BrowserWindow, Event, Input, WebContents } from "electron"
import type { TabManager } from "../browser/tab-manager"

export type BrowserShortcut =
  | "focus-omnibox"
  | "new-tab"
  | "close-tab"
  | "reload"
  | "next-tab"
  | "previous-tab"
  | "back"
  | "forward"

interface BrowserShortcutsContext {
  browserWindow: BrowserWindow
  tabManager: TabManager
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

  if (
    hasPrimaryModifier &&
    !hasOtherPrimaryModifier &&
    input.shift &&
    !input.alt &&
    key === "tab"
  ) {
    return "previous-tab"
  }

  if (!hasPrimaryModifier && !hasOtherPrimaryModifier && !input.shift && input.alt) {
    if (key === "arrowleft" || key === "left") return "back"
    if (key === "arrowright" || key === "right") return "forward"
  }

  return undefined
}

export function registerBrowserShortcuts(context: BrowserShortcutsContext): () => void {
  const { browserWindow, tabManager, focusOmnibox } = context
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
    }
  }
  const attach = (webContents: WebContents): void => {
    if (webContents.isDestroyed() || attachedWebContents.has(webContents)) return
    webContents.on("before-input-event", handleBeforeInputEvent)
    attachedWebContents.add(webContents)
  }

  attach(browserWindow.webContents)
  const unregisterPageViewListener = tabManager.onPageViewCreated((view) => {
    attach(view.webContents)
  })

  return () => {
    unregisterPageViewListener()
    for (const webContents of attachedWebContents) {
      webContents.off("before-input-event", handleBeforeInputEvent)
    }
    attachedWebContents.clear()
  }
}
