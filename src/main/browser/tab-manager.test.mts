import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import type { WebContentsView } from "electron"
import { TabManager } from "./tab-manager.ts"
import { createInternalPageRegistry } from "./internal-pages.mts"

function createFakePage(
  loads: string[],
  lifecycleChanges: string[],
  restoredStates: string[],
  closedPages: WebContentsView[],
): WebContentsView {
  let debuggerAttached = false
  let destroyed = false
  const webContents = Object.assign(new EventEmitter(), {
    id: 1,
    loadURL: async (url: string): Promise<void> => {
      loads.push(url)
    },
    stop: (): void => {
      loads.push("stop")
    },
    setWindowOpenHandler: (): void => undefined,
    close: (): void => {
      closedPages.push({ webContents } as unknown as WebContentsView)
      destroyed = true
    },
    destroy: (): void => {
      closedPages.push({ webContents } as unknown as WebContentsView)
      destroyed = true
    },
    isDestroyed: (): boolean => destroyed,
    getOSProcessId: (): number => 42,
    executeJavaScript: async (script: string): Promise<unknown> => {
      if (script.includes("photon:memory-saver:capture")) {
        return { scrollX: 12, scrollY: 34, fields: [] }
      }
      restoredStates.push(script)
      return undefined
    },
    debugger: {
      attach: (): void => {
        debuggerAttached = true
      },
      detach: (): void => {
        debuggerAttached = false
      },
      isAttached: (): boolean => debuggerAttached,
      sendCommand: async (_method: string, params: { state: string }): Promise<void> => {
        lifecycleChanges.push(params.state)
      },
    },
    getURL: (): string => loads.at(-1) ?? "",
    getTitle: (): string => "",
    navigationHistory: {
      canGoBack: (): boolean => false,
      canGoForward: (): boolean => false,
      goBack: (): void => undefined,
      goForward: (): void => undefined,
    },
  })
  return { webContents } as unknown as WebContentsView
}

function createManager(
  createdViews: WebContentsView[],
  loads: string[],
  pageChanges: Array<WebContentsView | undefined>,
  lifecycleChanges: string[] = [],
  changes: unknown[] = [],
  restoredStates: string[] = [],
  closedPages: WebContentsView[] = [],
): TabManager {
  return new TabManager({
    onChange: (change) => changes.push(change),
    onFocusOmnibox: () => undefined,
    onFocusPage: () => undefined,
    onPageViewChange: (view) => pageChanges.push(view),
    onCloseWindow: () => undefined,
    pages: createInternalPageRegistry("photon-browser"),
    createPageView: () => {
      const page = createFakePage(loads, lifecycleChanges, restoredStates, closedPages)
      createdViews.push(page)
      return page
    },
  })
}

test("starts with exactly one fresh New Tab and no page view", () => {
  const createdViews: WebContentsView[] = []
  const manager = createManager(createdViews, [], [])

  assert.deepEqual(
    manager.getSnapshot().tabs.map(({ id, url, kind }) => ({ id, url, kind })),
    [{ id: "tab-1", url: "photon-browser://new-tab", kind: "internal" }],
  )
  assert.equal(manager.getSnapshot().activeTabId, "tab-1")
  assert.equal(createdViews.length, 0)
  manager.dispose()
})

test("closing a navigated tab destroys its page and removes its listeners", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const closedPages: WebContentsView[] = []
  const manager = createManager(createdViews, loads, pageChanges, [], [], [], closedPages)

  await manager.navigateActive("https://same.example/")
  const webContents = createdViews[0]?.webContents as unknown as EventEmitter & {
    isDestroyed: () => boolean
  }
  const tabId = manager.getSnapshot().activeTabId

  manager.createTab()
  manager.closeTab(tabId)

  assert.equal(closedPages.length, 1)
  assert.equal(webContents.isDestroyed(), true)
  assert.equal(webContents.listenerCount("did-navigate"), 0)
  assert.equal(manager.getDiagnostics().tabs[0]?.pageRendererInitialized, false)
  manager.dispose()
})

test("returning to an internal page releases the tab page renderer", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const manager = createManager(createdViews, loads, pageChanges)

  await manager.navigateActive("https://same.example/")
  await manager.navigateActive("photon-browser://new-tab")

  assert.equal(createdViews[0]?.webContents.isDestroyed(), true)
  assert.equal(manager.getDiagnostics().tabs[0]?.pageRendererInitialized, false)
  manager.dispose()
})

test("ordinary navigation creates and loads one page", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const manager = createManager(createdViews, loads, pageChanges)

  await manager.navigateActive("https://same.example/")

  assert.equal(createdViews.length, 1)
  assert.deepEqual(loads, ["https://same.example/"])
  assert.equal(pageChanges.length, 1)
  assert.equal(manager.getSnapshot().tabs[0]?.kind, "web")
  assert.equal(manager.getSnapshot().tabs[0]?.showInUrlBar, true)
  manager.dispose()
})

test("stops loading the active page", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const manager = createManager(createdViews, loads, pageChanges)

  await manager.navigateActive("https://same.example/")
  manager.stopLoading()

  assert.deepEqual(loads, ["https://same.example/", "stop"])
  assert.equal(manager.getSnapshot().tabs[0]?.loading, false)
  manager.dispose()
})

test("repeated favicon events only emit a tab change when the favicon changes", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const changes: unknown[] = []
  const manager = createManager(createdViews, loads, pageChanges, [], changes)

  await manager.navigateActive("https://same.example/")
  changes.length = 0

  const webContents = createdViews[0]?.webContents as unknown as EventEmitter
  webContents.emit("page-favicon-updated", {}, ["data:image/png;base64,one"])
  changes.length = 0
  webContents.emit("page-title-updated", {}, "Updated title")

  assert.deepEqual(changes, [
    { type: "tab-updated", tabId: "tab-1", changes: { title: "Updated title" } },
  ])

  changes.length = 0
  webContents.emit("page-favicon-updated", {}, ["data:image/png;base64,one"])
  webContents.emit("page-favicon-updated", {}, ["data:image/png;base64,two"])

  assert.deepEqual(
    changes.map(
      (change) => (change as { type: string; changes: { faviconUrl?: string } }).changes.faviconUrl,
    ),
    ["data:image/png;base64,two"],
  )
  manager.dispose()
})

test("switching back to a page restores its view and URL state", async () => {
  const createdViews: WebContentsView[] = []
  const loads: string[] = []
  const pageChanges: Array<WebContentsView | undefined> = []
  const manager = createManager(createdViews, loads, pageChanges)

  await manager.navigateActive("https://same.example/")
  const firstTabId = manager.getSnapshot().activeTabId
  manager.createTab()
  await manager.selectTab(firstTabId)

  assert.equal(pageChanges.at(-1), createdViews[0])
  assert.equal(manager.getSnapshot().tabs[0]?.url, "https://same.example/")
  manager.dispose()
})

test("creating multiple tabs keeps normal tab identity and selection", async () => {
  const manager = createManager([], [], [])

  const secondTabId = manager.createTab()
  const thirdTabId = manager.createTab()

  assert.deepEqual(
    manager.getSnapshot().tabs.map(({ id, url }) => ({ id, url })),
    [
      { id: "tab-1", url: "photon-browser://new-tab" },
      { id: secondTabId, url: "photon-browser://new-tab" },
      { id: thirdTabId, url: "photon-browser://new-tab" },
    ],
  )
  assert.equal(manager.getSnapshot().activeTabId, thirdTabId)
  await manager.selectTab("tab-1" as typeof secondTabId)
  assert.equal(manager.getSnapshot().activeTabId, "tab-1")
  manager.dispose()
})

test("discards an inactive page and restores its saved state on selection", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const loads: string[] = []
  const restoredStates: string[] = []
  const closedPages: WebContentsView[] = []
  const manager = createManager([], loads, [], [], [], restoredStates, closedPages)

  await manager.navigateActive("https://same.example/")
  const firstTabId = manager.getSnapshot().activeTabId
  manager.createTab()

  context.mock.timers.tick(59_999)
  assert.equal(closedPages.length, 0)

  context.mock.timers.tick(1)
  for (let attempt = 0; attempt < 100 && closedPages.length === 0; attempt += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve))
  }
  assert.equal(closedPages.length, 1)
  assert.equal(manager.getSnapshot().tabs[0]?.lifecycleState, "frozen")

  await manager.selectTab(firstTabId)
  assert.equal(closedPages.length, 1)
  assert.equal(restoredStates.length, 1)
  assert.match(restoredStates[0] ?? "", /"scrollX":12/)
  assert.deepEqual(loads, ["https://same.example/", "https://same.example/"])
  assert.equal(manager.getSnapshot().tabs[0]?.lifecycleState, "active")
  manager.dispose()
})

test("disabling memory saver keeps inactive pages active", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const lifecycleChanges: string[] = []
  const manager = createManager([], [], [], lifecycleChanges)

  await manager.navigateActive("https://same.example/")
  manager.createTab()
  manager.setMemorySaverSettings({ enabled: false, level: "balanced" })

  context.mock.timers.tick(60_000)
  await Promise.resolve()
  assert.deepEqual(lifecycleChanges, [])
  manager.dispose()
})
