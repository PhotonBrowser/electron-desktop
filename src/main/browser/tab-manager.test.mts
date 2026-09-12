import assert from "node:assert/strict"
import test from "node:test"
import type { BrowserNavigationCommand, PhotonBrowserUpdate, TabId } from "@/preload/photon-api"
import { createInternalPageRegistry } from "./internal-pages.mts"
import { TabManager } from "./tab-manager.ts"

function createManager(
  updates: PhotonBrowserUpdate[] = [],
  commands: Array<{ tabId: TabId; command: BrowserNavigationCommand }> = [],
): TabManager {
  return new TabManager({
    onChange: (update) => updates.push(update),
    onFocusOmnibox: () => undefined,
    onFocusPage: () => undefined,
    onNavigationCommand: (tabId, command) => commands.push({ tabId, command }),
    onCloseWindow: () => undefined,
    pages: createInternalPageRegistry("photon-browser"),
  })
}

test("starts with one internal New Tab and no guest ownership in main", () => {
  const manager = createManager()

  assert.deepEqual(manager.getSnapshot().tabs[0], {
    id: "tab-1",
    kind: "internal",
    internalPage: "new-tab",
    showInUrlBar: false,
    url: "photon-browser://new-tab",
    title: "New Tab",
    loading: false,
    lifecycleState: "active",
    canGoBack: false,
    canGoForward: false,
    crashed: false,
    error: null,
  })
  assert.deepEqual(manager.getDiagnostics().tabs[0], {
    tabId: "tab-1",
    webviewAttached: false,
  })
  manager.dispose()
})

test("resolves omnibox input into web tab state without creating a native page view", async () => {
  const updates: PhotonBrowserUpdate[] = []
  const manager = createManager(updates)

  await manager.navigateActive("same.example")

  const tab = manager.getSnapshot().tabs[0]
  assert.equal(tab?.kind, "web")
  assert.equal(tab?.url, "https://same.example/")
  assert.equal(tab?.loading, true)
  assert.equal(updates.at(-1)?.type, "tab-updated")
  manager.dispose()
})

test("accepts authoritative webview navigation, title, favicon and history state", async () => {
  const manager = createManager()
  await manager.navigateActive("https://example.test/")
  manager.updateFromWebview("tab-1" as TabId, {
    url: "https://example.test/page",
    title: "Example",
    faviconUrl: "data:image/png;base64,icon",
    loading: false,
    canGoBack: true,
    canGoForward: false,
  })

  assert.deepEqual(manager.getSnapshot().tabs[0], {
    id: "tab-1",
    kind: "web",
    internalPage: null,
    showInUrlBar: true,
    url: "https://example.test/page",
    title: "Example",
    faviconUrl: "data:image/png;base64,icon",
    loading: false,
    lifecycleState: "active",
    canGoBack: true,
    canGoForward: false,
    crashed: false,
    error: null,
  })
  manager.updateFromWebview("tab-1" as TabId, { faviconUrl: null })
  assert.equal(manager.getSnapshot().tabs[0]?.faviconUrl, undefined)
  manager.dispose()
})

test("routes navigation controls to the active webview", async () => {
  const commands: Array<{ tabId: TabId; command: BrowserNavigationCommand }> = []
  const manager = createManager([], commands)
  await manager.navigateActive("https://example.test/")
  manager.updateFromWebview("tab-1" as TabId, { canGoBack: true, canGoForward: true })

  manager.back()
  manager.forward()
  manager.reload()
  manager.stopLoading()

  assert.deepEqual(commands, [
    { tabId: "tab-1", command: "back" },
    { tabId: "tab-1", command: "forward" },
    { tabId: "tab-1", command: "reload" },
    { tabId: "tab-1", command: "stop" },
  ])
  manager.dispose()
})

test("switching tabs preserves each tab's browser state", async () => {
  const manager = createManager()
  await manager.navigateActive("https://first.example/")
  const firstTabId = manager.getSnapshot().activeTabId
  const secondTabId = manager.createTab()
  await manager.selectTab(firstTabId)

  assert.equal(manager.getSnapshot().activeTabId, firstTabId)
  assert.equal(manager.getSnapshot().tabs[0]?.url, "https://first.example/")
  assert.equal(manager.getSnapshot().tabs[1]?.id, secondTabId)
  assert.equal(manager.getDiagnostics().tabs[0]?.webviewAttached, true)
  manager.dispose()
})

test("memory saver freezes inactive tabs and reactivates them without page-state plumbing", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const manager = createManager()
  await manager.navigateActive("https://first.example/")
  const firstTabId = manager.getSnapshot().activeTabId
  manager.createTab()

  context.mock.timers.tick(60_000)
  assert.equal(manager.getSnapshot().tabs[0]?.lifecycleState, "frozen")
  await manager.selectTab(firstTabId)
  assert.equal(manager.getSnapshot().tabs[0]?.lifecycleState, "active")
  manager.dispose()
})
