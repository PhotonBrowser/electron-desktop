import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import type { WebContents } from "electron"
import type { TabId } from "@/shared/photon-api"
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
  assert.equal(resolveBrowserShortcut(input({ key: "T" })), "new-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "W" })), "close-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "R" })), "reload")
  assert.equal(resolveBrowserShortcut(input({ key: "Tab" })), "next-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "Tab", shift: true })), "previous-tab")
  assert.equal(resolveBrowserShortcut(input({ key: "T", shift: true })), "reopen-tab")
  assert.equal(
    resolveBrowserShortcut(input({ key: "ArrowLeft", control: false, alt: true })),
    "back",
  )
  assert.equal(
    resolveBrowserShortcut(input({ key: "ArrowRight", control: false, alt: true })),
    "forward",
  )
  assert.equal(resolveBrowserShortcut(input({ key: "r", shift: true })), undefined)
  assert.equal(resolveBrowserShortcut(input({ key: "f" })), undefined)
  assert.equal(resolveBrowserShortcut(input({ type: "char" })), undefined)
  assert.equal(resolveBrowserShortcut(input({ isAutoRepeat: true })), undefined)
})

test("attaches shortcuts to webview guests created after registration", () => {
  const chrome = new EventEmitter() as EventEmitter & { isDestroyed: () => boolean }
  const guest = new EventEmitter() as EventEmitter & { isDestroyed: () => boolean }
  chrome.isDestroyed = () => false
  guest.isDestroyed = () => false

  let focusedOmnibox = 0
  const manager = {
    createTab: () => "tab-2" as TabId,
    reopenClosedTab: () => undefined,
    closeActiveTab: () => undefined,
    reload: () => undefined,
    selectRelativeTab: () => undefined,
    back: () => undefined,
    forward: () => undefined,
    toggleDevTools: () => undefined,
  }
  const unregister = registerBrowserShortcuts({
    chromeWebContents: chrome as unknown as WebContents,
    tabManager: manager,
    focusOmnibox: () => {
      focusedOmnibox += 1
    },
  })

  chrome.emit("did-attach-webview", {}, guest)
  chrome.emit("did-attach-webview", {}, guest)
  const event = { preventDefault: () => undefined }
  guest.emit("before-input-event", event, input())

  assert.equal(focusedOmnibox, 1)
  guest.emit("destroyed")
  guest.emit("before-input-event", event, input())
  assert.equal(focusedOmnibox, 1)
  unregister()
  guest.emit("before-input-event", event, input())
  assert.equal(focusedOmnibox, 1)
})
