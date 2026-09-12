import assert from "node:assert/strict"
import test from "node:test"
import type { PhotonBrowserUpdate, PhotonNavigationRequest, TabId } from "@/shared/photon-api"
import { createInternalPageRegistry } from "./internal-pages.mts"
import { TabManager } from "./tab-manager.ts"

function createManager(
  updates: PhotonBrowserUpdate[] = [],
  commands: PhotonNavigationRequest[] = [],
): TabManager {
  return new TabManager({
    onChange: (update) => updates.push(update),
    onFocusOmnibox: () => undefined,
    onFocusPage: () => undefined,
    onNavigationCommand: (request) => commands.push(request),
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
    webviewMounted: false,
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

test("sends a navigation request when an existing webview gets a new URL", async () => {
  const commands: PhotonNavigationRequest[] = []
  const manager = createManager([], commands)

  await manager.navigateActive("https://first.example/")
  await manager.navigateActive("https://second.example/")

  assert.deepEqual(commands, [
    { tabId: "tab-1", command: "navigate", url: "https://second.example/" },
  ])
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
  const commands: PhotonNavigationRequest[] = []
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
  assert.equal(manager.getDiagnostics().tabs[0]?.webviewMounted, true)
  manager.dispose()
})

test("closing the active tab prefers the tab to the right, then the left", async () => {
  const manager = createManager()
  const firstTabId = manager.getSnapshot().activeTabId
  const secondTabId = manager.createTab("https://second.example/", false)
  const thirdTabId = manager.createTab("https://third.example/", false)

  await manager.selectTab(secondTabId)
  manager.closeTab(secondTabId)
  assert.equal(manager.getSnapshot().activeTabId, thirdTabId)

  manager.closeTab(thirdTabId)
  assert.equal(manager.getSnapshot().activeTabId, firstTabId)
  assert.ok(manager.getSnapshot().tabs.some((tab) => tab.id === manager.getSnapshot().activeTabId))
  manager.dispose()
})

test("reopens closed tabs in last-closed order with their title", async () => {
  const manager = createManager()
  const firstTabId = manager.getSnapshot().activeTabId
  await manager.navigateActive("https://first.example/")
  manager.updateFromWebview(firstTabId, { title: "First page" })
  const secondTabId = manager.createTab("https://second.example/", false)
  manager.updateFromWebview(secondTabId, { title: "Second page" })
  manager.createTab("https://third.example/", false)

  manager.closeTab(firstTabId)
  manager.closeTab(secondTabId)
  manager.reopenClosedTab()

  const reopened = manager.getSnapshot().tabs.at(-1)
  assert.equal(reopened?.url, "https://second.example/")
  assert.equal(reopened?.title, "Second page")
  assert.equal(manager.getSnapshot().activeTabId, reopened?.id)

  manager.reopenClosedTab()
  const reopenedFirst = manager.getSnapshot().tabs.at(-1)
  assert.equal(reopenedFirst?.url, "https://first.example/")
  assert.equal(reopenedFirst?.title, "First page")
  manager.dispose()
})

test("does not route back or forward when Chromium reports no history", async () => {
  const commands: PhotonNavigationRequest[] = []
  const manager = createManager([], commands)
  await manager.navigateActive("https://example.test/")

  manager.back()
  manager.forward()
  assert.deepEqual(commands, [])
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
