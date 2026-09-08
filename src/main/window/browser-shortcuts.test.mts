import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import type { BrowserWindow } from "electron"
import type { TabManager } from "../browser/tab-manager.ts"
import { registerBrowserShortcuts, resolveBrowserShortcut } from "./browser-shortcuts.ts"

function input(
  overrides: Partial<Parameters<typeof resolveBrowserShortcut>[0]> = {},
): Parameters<typeof resolveBrowserShortcut>[0] {
  const primaryModifier = process.platform === "darwin" ? { meta: true } : { control: true }
  return {
    type: "keyDown",
    key: "l",
    isAutoRepeat: false,
    shift: false,
    control: false,
    alt: false,
    meta: false,
    ...primaryModifier,
    ...overrides,
  }
}

test("resolves browser shortcuts with exact modifiers", () => {
  assert.equal(resolveBrowserShortcut(input({ key: "L" })), "focus-omnibox")
  assert.equal(resolveBrowserShortcut(input({ key: "Tab" })), "next-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "Tab", shift: true })), "previous-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "r", shift: true })), undefined)
  assert.equal(resolveBrowserShortcut(input({ type: "char" })), undefined)
  assert.equal(resolveBrowserShortcut(input({ isAutoRepeat: true })), undefined)
})

test("attaches shortcuts to page views created after registration", () => {
  const chrome = new EventEmitter() as EventEmitter & { isDestroyed: () => boolean }
  const page = new EventEmitter() as EventEmitter & { isDestroyed: () => boolean }
  chrome.isDestroyed = () => false
  page.isDestroyed = () => false

  type PageView = { webContents: typeof page }
  let pageViewListener: ((view: PageView) => void) | undefined
  let focusedOmnibox = 0
  const manager = {
    onPageViewCreated: (listener: (view: PageView) => void) => {
      pageViewListener = listener
      return () => {
        pageViewListener = undefined
      }
    },
    createTab: () => "tab-2",
    closeActiveTab: () => undefined,
    reload: () => undefined,
    selectRelativeTab: () => undefined,
    back: () => undefined,
    forward: () => undefined,
  }
  const unregister = registerBrowserShortcuts({
    browserWindow: { webContents: chrome } as unknown as BrowserWindow,
    tabManager: manager as unknown as TabManager,
    focusOmnibox: () => {
      focusedOmnibox += 1
    },
  })

  pageViewListener?.({ webContents: page })
  const event = { preventDefault: () => undefined }
  page.emit("before-input-event", event, input())

  assert.equal(focusedOmnibox, 1)
  unregister()
  page.emit("before-input-event", event, input())
  assert.equal(focusedOmnibox, 1)
})
