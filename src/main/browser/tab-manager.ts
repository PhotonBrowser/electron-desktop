import { WebContentsView, type BrowserWindow, type Event, type HandlerDetails } from "electron"
import type { BrowserTab, TabId } from "@/preload/photon-api"
import { CHROME_LAYOUT } from "@/preload/photon-api"
import { resolveNavigationUrl } from "./navigation-url.mts"
import { type InternalPageRegistry, resolveTabKind } from "./internal-pages.mts"

const NEW_TAB_TITLE = "New Tab"
type CloseLastTabAction = "close-window" | "new-tab"
const CLOSE_LAST_TAB_ACTION: CloseLastTabAction = "close-window"

export interface TabManagerSnapshot {
  tabs: BrowserTab[]
  activeTabId: TabId
}

type StateListener = () => void

interface TabRecord {
  state: BrowserTab
  view?: WebContentsView
  onStartLoading: () => void
  onStopLoading: () => void
  onNavigate: () => void
  onNavigateInPage: (
    event: Event,
    url: string,
    isMainFrame: boolean,
    frameProcessId: number,
    frameRoutingId: number,
  ) => void
  onTitleUpdated: (event: Event, title: string) => void
  onFaviconUpdated: (event: Event, favicons: string[]) => void
  onFailLoad: (
    event: Event,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean,
  ) => void
  onWindowOpen: (details: HandlerDetails) => { action: "deny" }
}

export class TabManager {
  private readonly browserWindow: BrowserWindow
  private readonly onChange: StateListener
  private readonly onFocusOmnibox: () => void
  private readonly onPersist: ((snapshot: TabManagerSnapshot) => void) | undefined
  private readonly pages: InternalPageRegistry
  private readonly tabs = new Map<TabId, TabRecord>()
  private readonly handleResize = (): void => this.updateBounds()
  private activeTabId: TabId | null = null
  private nextTabNumber = 1

  constructor(
    browserWindow: BrowserWindow,
    onChange: StateListener,
    onFocusOmnibox: () => void,
    pages: InternalPageRegistry,
    restored?: { tabs: Array<Pick<BrowserTab, "id" | "url">>; activeTabId: TabId },
    onPersist?: (snapshot: TabManagerSnapshot) => void,
  ) {
    this.browserWindow = browserWindow
    this.onChange = () => {
      onChange()
      if (this.activeTabId) this.onPersist?.(this.getSnapshot())
    }
    this.onFocusOmnibox = onFocusOmnibox
    this.onPersist = onPersist
    this.pages = pages
    this.browserWindow.on("resize", this.handleResize)
    if (restored) {
      for (const tab of restored.tabs) this.createTab(tab.url, false, false, tab.id)
      const restoredNumbers = restored.tabs
        .map(({ id }) => /^tab-(\d+)$/.exec(id)?.[1])
        .filter((number): number is string => number !== undefined)
        .map(Number)
      this.nextTabNumber = Math.max(0, ...restoredNumbers) + 1
      if (this.tabs.has(restored.activeTabId)) this.showTab(restored.activeTabId)
    }
    if (!this.activeTabId) this.createTab(this.pages.newTabUrl, false, false)
  }

  getSnapshot(): TabManagerSnapshot {
    if (!this.activeTabId) throw new Error("Photon has no active tab")

    return {
      tabs: [...this.tabs.values()].map((record) => record.state),
      activeTabId: this.activeTabId,
    }
  }

  createTab(
    url: string = this.pages.newTabUrl,
    focusOmnibox = true,
    emit = true,
    restoredId?: TabId,
  ): TabId {
    const id = restoredId ?? (("tab-" + this.nextTabNumber++) as TabId)
    const record = this.createRecord(id, url)

    this.tabs.set(id, record)
    this.showTab(id)

    if (resolveTabKind(url, this.pages) === "web") void this.navigate(id, url)
    if (emit) this.onChange()
    if (focusOmnibox) this.onFocusOmnibox()
    return id
  }

  selectTab(id: TabId): void {
    if (!this.tabs.has(id) || id === this.activeTabId) {
      if (id === this.activeTabId) this.focusSelectedTab()
      return
    }

    this.showTab(id)
    this.focusSelectedTab()
    this.onChange()
  }

  closeTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return

    if (this.tabs.size === 1) {
      this.destroyRecord(id)
      this.activeTabId = null
      this.onPersist?.({ tabs: [], activeTabId: id })
      if (CLOSE_LAST_TAB_ACTION === "close-window") this.browserWindow.close()
      else this.createTab(undefined, true)
      return
    }

    const ids = [...this.tabs.keys()]
    const index = ids.indexOf(id)
    if (index === -1) return

    const wasActive = id === this.activeTabId
    const nextId = ids[index + 1] ?? ids[index - 1]
    this.destroyRecord(id)

    if (!wasActive && nextId) {
      this.onChange()
      return
    }

    if (nextId) {
      this.showTab(nextId)
      this.focusSelectedTab()
      this.onChange()
      return
    }
  }

  reorderTabs(tabIds: readonly TabId[]): void {
    const currentIds = [...this.tabs.keys()]
    if (
      tabIds.length !== currentIds.length ||
      tabIds.every((tabId, index) => tabId === currentIds[index])
    ) {
      return
    }

    const reorderedTabs = new Map<TabId, TabRecord>()
    for (const tabId of tabIds) {
      const record = this.tabs.get(tabId)
      if (!record || reorderedTabs.has(tabId)) return
      reorderedTabs.set(tabId, record)
    }

    this.tabs.clear()
    for (const [tabId, record] of reorderedTabs) this.tabs.set(tabId, record)
    this.onChange()
  }

  back(): void {
    const record = this.activeRecord()
    if (record?.view && record.state.canGoBack) record.view.webContents.navigationHistory.goBack()
  }

  forward(): void {
    const record = this.activeRecord()
    if (record?.view && record.state.canGoForward)
      record.view.webContents.navigationHistory.goForward()
  }

  reload(): void {
    this.activeRecord()?.view?.webContents.reload()
  }

  closeActiveTab(): void {
    if (this.activeTabId) this.closeTab(this.activeTabId)
  }

  async navigateActive(input: string): Promise<void> {
    if (this.activeTabId) await this.navigate(this.activeTabId, input)
  }

  updateBounds(): void {
    const record = this.activeRecord()
    if (!record) return

    const [width = 0, height = 0] = this.browserWindow.getContentSize()
    const inset = CHROME_LAYOUT.contentInset
    record.view?.setBounds({
      x: inset,
      y: CHROME_LAYOUT.contentTop + inset,
      width: Math.max(0, width - inset * 2),
      height: Math.max(0, height - CHROME_LAYOUT.contentTop - inset * 2),
    })
    record.view?.setBorderRadius(CHROME_LAYOUT.contentRadius)
  }

  dispose(): void {
    this.browserWindow.off("resize", this.handleResize)
    for (const id of this.tabs.keys()) this.destroyRecord(id)
    this.tabs.clear()
    this.activeTabId = null
  }

  private createRecord(id: TabId, url: string): TabRecord {
    const record: TabRecord = {
      state: {
        id,
        kind: resolveTabKind(url, this.pages),
        internalPage: this.pages.resolve(url)?.id ?? null,
        showInUrlBar: this.pages.resolve(url)?.showInUrlBar ?? true,
        url,
        title: this.pages.resolve(url)?.title ?? "Loading…",
        loading: resolveTabKind(url, this.pages) === "web",
        canGoBack: false,
        canGoForward: false,
      },
      onStartLoading: () => {
        record.state = { ...record.state, loading: true }
        this.onChange()
      },
      onStopLoading: () => {
        this.syncNavigation(record)
        record.state = { ...record.state, loading: false }
        this.onChange()
      },
      onNavigate: () => {
        this.syncNavigation(record)
        this.onChange()
      },
      onNavigateInPage: (_event, _url, isMainFrame) => {
        if (isMainFrame) {
          this.syncNavigation(record)
          this.onChange()
        }
      },
      onTitleUpdated: (_event, title) => {
        record.state = { ...record.state, title: title || NEW_TAB_TITLE }
        this.onChange()
      },
      onFaviconUpdated: (_event, favicons) => {
        const faviconUrl = favicons[0]
        if (faviconUrl) record.state = { ...record.state, faviconUrl }
        else {
          const nextState = { ...record.state }
          delete nextState.faviconUrl
          record.state = nextState
        }
        this.onChange()
      },
      onFailLoad: (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        record.state = { ...record.state, loading: false }
        if (process.env.NODE_ENV !== "production") {
          console.error("Tab navigation failed (" + errorCode + "): " + errorDescription)
        }
        this.onChange()
      },
      onWindowOpen: (details) => {
        if (/^https?:\/\//i.test(details.url)) this.createTab(details.url)
        return { action: "deny" }
      },
    }

    return record
  }

  private ensureView(record: TabRecord): WebContentsView {
    if (record.view) return record.view
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: true,
      },
    })
    record.view = view
    view.webContents.on("did-start-loading", record.onStartLoading)
    view.webContents.on("did-stop-loading", record.onStopLoading)
    view.webContents.on("did-navigate", record.onNavigate)
    view.webContents.on("did-navigate-in-page", record.onNavigateInPage)
    view.webContents.on("page-title-updated", record.onTitleUpdated)
    view.webContents.on("page-favicon-updated", record.onFaviconUpdated)
    view.webContents.on("did-fail-load", record.onFailLoad)
    view.webContents.setWindowOpenHandler(record.onWindowOpen)
    return view
  }

  private async navigate(id: TabId, input: string): Promise<void> {
    const record = this.tabs.get(id)
    if (!record) return

    const url = resolveNavigationUrl(input, this.pages)
    const internalPage = this.pages.resolve(url)
    if (internalPage) {
      this.hideTab(id)
      record.state = {
        ...record.state,
        kind: "internal",
        internalPage: internalPage.id,
        showInUrlBar: internalPage.showInUrlBar,
        url,
        title: internalPage.title,
        loading: false,
        canGoBack: false,
        canGoForward: false,
      }
      this.onChange()
      return
    }
    const view = this.ensureView(record)
    record.state = { ...record.state, kind: "web", url, title: "Loading…", loading: true }
    if (this.activeTabId === id) this.showTab(id)
    this.onChange()
    try {
      await view.webContents.loadURL(url)
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        const message = error instanceof Error ? error.message : "Unknown navigation error"
        console.error("Navigation request failed: " + message)
      }
    }
  }

  selectRelativeTab(offset: -1 | 1): void {
    const ids = [...this.tabs.keys()]
    if (ids.length < 2 || !this.activeTabId) return

    const currentIndex = ids.indexOf(this.activeTabId)
    const nextIndex = (currentIndex + offset + ids.length) % ids.length
    this.selectTab(ids[nextIndex] as TabId)
  }

  private syncNavigation(record: TabRecord): void {
    if (!record.view) return
    const { webContents } = record.view
    const url = webContents.getURL()
    const title = webContents.getTitle()
    record.state = {
      ...record.state,
      url: url || record.state.url,
      title: title || record.state.title,
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
    }
  }

  private activeRecord(): TabRecord | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
  }

  private showTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return

    if (this.activeTabId && this.activeTabId !== id) this.hideTab(this.activeTabId)
    this.activeTabId = id
    if (record.view) this.browserWindow.contentView.addChildView(record.view, 0)
    this.updateBounds()
  }

  private hideTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (record?.view) record.view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  }

  private focusActiveTab(): void {
    const record = this.activeRecord()
    if (record?.view) record.view.webContents.focus()
  }

  private focusSelectedTab(): void {
    const record = this.activeRecord()
    if (!record) return
    if (record.state.kind === "web") this.focusActiveTab()
    else this.onFocusOmnibox()
  }

  private destroyRecord(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return
    if (!record.view) {
      this.tabs.delete(id)
      return
    }
    this.browserWindow.contentView.removeChildView(record.view)
    record.view.webContents.off("did-start-loading", record.onStartLoading)
    record.view.webContents.off("did-stop-loading", record.onStopLoading)
    record.view.webContents.off("did-navigate", record.onNavigate)
    record.view.webContents.off("did-navigate-in-page", record.onNavigateInPage)
    record.view.webContents.off("page-title-updated", record.onTitleUpdated)
    record.view.webContents.off("page-favicon-updated", record.onFaviconUpdated)
    record.view.webContents.off("did-fail-load", record.onFailLoad)
    record.view.webContents.close()
    this.tabs.delete(id)
  }
}
