import * as electron from "electron"
import type { Event, HandlerDetails, WebContentsView } from "electron"
import type {
  BrowserTab,
  BrowserTabChanges,
  MemorySaverLevel,
  MemorySaverSettings,
  PhotonBrowserUpdate,
  TabId,
} from "@/preload/photon-api"
import { resolveNavigationUrl } from "./navigation-url.mts"
import { type InternalPageRegistry, resolveTabKind } from "./internal-pages.mts"
import { deletePageState, restorePageState, savePageState } from "./page-state.mts"

const NEW_TAB_TITLE = "New Tab"
type CloseLastTabAction = "close-window" | "new-tab"
const CLOSE_LAST_TAB_ACTION: CloseLastTabAction = "close-window"
const MEMORY_SAVER_DELAYS: Record<MemorySaverLevel, number> = {
  moderate: 5 * 60 * 1000,
  balanced: 60 * 1000,
  maximum: 15 * 1000,
}
const DEFAULT_MEMORY_SAVER_SETTINGS: MemorySaverSettings = {
  enabled: true,
  level: "balanced",
}

export interface TabManagerSnapshot {
  tabs: BrowserTab[]
  activeTabId: TabId
}

export interface TabManagerDiagnostics {
  activeTabId: TabId | null
  tabs: Array<{
    tabId: TabId
    pageRendererInitialized: boolean
    pageWebContentsId: number | null
    pageProcessId: number | null
  }>
}

type StateListener = (update: PhotonBrowserUpdate) => void
type PageViewListener = (view: WebContentsView | undefined) => void
type PageViewCreatedListener = (view: WebContentsView) => void

export interface TabManagerOptions {
  onChange: StateListener
  onFocusOmnibox: () => void
  onFocusPage: (view: WebContentsView) => void
  onPageViewChange: PageViewListener
  onCloseWindow: () => void
  pages: InternalPageRegistry
  createPageView?: () => WebContentsView
}

interface TabRecord {
  state: BrowserTab
  view?: WebContentsView
  inactiveTimer?: ReturnType<typeof setTimeout>
  savedPageStatePath: string | undefined
  lifecycleState: "active" | "frozen"
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
  private readonly onChange: StateListener
  private readonly onFocusOmnibox: () => void
  private readonly onFocusPage: (view: WebContentsView) => void
  private readonly onPageViewChange: PageViewListener
  private readonly onCloseWindow: () => void
  private readonly pages: InternalPageRegistry
  private readonly createPageView: () => WebContentsView
  private readonly pageViewCreatedListeners = new Set<PageViewCreatedListener>()
  private readonly tabs = new Map<TabId, TabRecord>()
  private activeTabId: TabId | null = null
  private nextTabNumber = 1
  private memorySaverSettings: MemorySaverSettings = DEFAULT_MEMORY_SAVER_SETTINGS

  constructor(options: TabManagerOptions) {
    this.onChange = options.onChange
    this.onFocusOmnibox = options.onFocusOmnibox
    this.onFocusPage = options.onFocusPage
    this.onPageViewChange = options.onPageViewChange
    this.onCloseWindow = options.onCloseWindow
    this.pages = options.pages
    this.createPageView =
      options.createPageView ??
      (() =>
        new electron.WebContentsView({
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: true,
          },
        }))
    this.createTab(this.pages.newTabUrl, false, false)
  }

  getSnapshot(): TabManagerSnapshot {
    if (!this.activeTabId) throw new Error("Photon has no active tab")

    return {
      tabs: [...this.tabs.values()].map((record) => record.state),
      activeTabId: this.activeTabId,
    }
  }

  getDiagnostics(): TabManagerDiagnostics {
    return {
      activeTabId: this.activeTabId,
      tabs: [...this.tabs.values()].map((record) => {
        const pageWebContents = record.view?.webContents
        return {
          tabId: record.state.id,
          pageRendererInitialized: pageWebContents !== undefined,
          pageWebContentsId: pageWebContents?.id ?? null,
          pageProcessId:
            pageWebContents && !pageWebContents.isDestroyed()
              ? pageWebContents.getOSProcessId()
              : null,
        }
      }),
    }
  }

  onPageViewCreated(listener: PageViewCreatedListener): () => void {
    this.pageViewCreatedListeners.add(listener)
    for (const record of this.tabs.values()) {
      if (record.view) listener(record.view)
    }
    return () => this.pageViewCreatedListeners.delete(listener)
  }

  createTab(url: string = this.pages.newTabUrl, focusOmnibox = true, emit = true): TabId {
    const id = ("tab-" + this.nextTabNumber++) as TabId
    const record = this.createRecord(id, url)
    const previousActiveTabId = this.activeTabId

    this.tabs.set(id, record)
    void this.activateTab(id)
    if (emit) {
      this.onChange({ type: "tab-added", tab: record.state })
      if (this.activeTabId !== previousActiveTabId && this.activeTabId) {
        this.onChange({ type: "active-tab-changed", activeTabId: this.activeTabId })
      }
    }
    if (focusOmnibox) this.onFocusOmnibox()
    return id
  }

  async selectTab(id: TabId): Promise<void> {
    if (!this.tabs.has(id)) return
    if (id === this.activeTabId && this.isTabActivated(id)) {
      this.focusSelectedTab()
      return
    }

    const previousActiveTabId = this.activeTabId
    await this.activateTab(id)
    this.focusSelectedTab()
    if (this.activeTabId !== previousActiveTabId && this.activeTabId) {
      this.onChange({ type: "active-tab-changed", activeTabId: this.activeTabId })
    }
  }

  closeTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return

    if (this.tabs.size === 1) {
      this.destroyRecord(id)
      this.activeTabId = null
      if (CLOSE_LAST_TAB_ACTION === "close-window") this.onCloseWindow()
      else this.createTab(undefined, true)
      return
    }

    const ids = [...this.tabs.keys()]
    const index = ids.indexOf(id)
    if (index === -1) return

    const wasActive = id === this.activeTabId
    const nextId = ids[index + 1] ?? ids[index - 1]
    this.destroyRecord(id)
    this.onChange({ type: "tab-removed", tabId: id })

    if (!wasActive && nextId) {
      return
    }

    if (nextId) {
      const previousActiveTabId = this.activeTabId
      void this.activateTab(nextId).then(() => {
        this.focusSelectedTab()
      })
      if (this.activeTabId !== previousActiveTabId) {
        this.onChange({ type: "active-tab-changed", activeTabId: nextId })
      }
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
    this.onChange({ type: "tabs-reordered", tabIds: [...this.tabs.keys()] })
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

  stopLoading(): void {
    const record = this.activeRecord()
    if (!record?.view) return

    record.view.webContents.stop()
    this.updateTab(record, { ...record.state, loading: false })
  }

  closeActiveTab(): void {
    if (this.activeTabId) this.closeTab(this.activeTabId)
  }

  setMemorySaverSettings(settings: MemorySaverSettings): void {
    this.memorySaverSettings = settings

    for (const record of this.tabs.values()) {
      if (!record.view) continue
      if (this.isPageActive(record)) {
        void this.activatePage(record)
        continue
      }
      if (!settings.enabled) {
        this.clearInactiveTimer(record)
        void this.activatePage(record)
        continue
      }
      if (record.lifecycleState === "frozen") continue
      this.scheduleInactiveTab(record)
    }
  }

  async navigateActive(input: string): Promise<void> {
    if (this.activeTabId) await this.navigate(this.activeTabId, input)
  }

  async activateTab(id: TabId): Promise<void> {
    const record = this.tabs.get(id)
    if (!record) return
    if (id === this.activeTabId && this.isTabActivated(id)) return

    if (this.activeTabId && this.activeTabId !== id) this.hideTab(this.activeTabId)
    this.activeTabId = id

    if (record.state.kind === "internal") return

    const shouldNavigate = !record.view
    await this.activatePage(record)
    const currentState: BrowserTab = record.state
    if (this.activeTabId !== id || currentState.kind === "internal") return
    const view = this.ensureView(record)
    this.onPageViewChange(view)
    if (shouldNavigate) await this.loadPage(record, record.state.url)
  }

  dispose(): void {
    for (const id of [...this.tabs.keys()]) this.destroyRecord(id)
    this.tabs.clear()
    this.pageViewCreatedListeners.clear()
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
        lifecycleState: "active",
        canGoBack: false,
        canGoForward: false,
      },
      savedPageStatePath: undefined,
      lifecycleState: "active",
      onStartLoading: () => {
        this.updateTab(record, { ...record.state, loading: true })
      },
      onStopLoading: () => {
        this.updateTab(record, { ...this.getSynchronizedState(record), loading: false })
      },
      onNavigate: () => {
        this.updateTab(record, this.getSynchronizedState(record))
      },
      onNavigateInPage: (_event, _url, isMainFrame) => {
        if (isMainFrame) {
          this.updateTab(record, this.getSynchronizedState(record))
        }
      },
      onTitleUpdated: (_event, title) => {
        this.updateTab(record, { ...record.state, title: title || NEW_TAB_TITLE })
      },
      onFaviconUpdated: (_event, favicons) => {
        const faviconUrl = favicons[0]
        if (faviconUrl) {
          this.updateTab(record, { ...record.state, faviconUrl })
          return
        }

        if (!record.state.faviconUrl) return
        const nextState = { ...record.state }
        delete nextState.faviconUrl
        this.updateTab(record, nextState)
      },
      onFailLoad: (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
        if (!isMainFrame) return
        if (process.env.NODE_ENV !== "production") {
          console.error("Tab navigation failed (" + errorCode + "): " + errorDescription)
        }
        this.updateTab(record, { ...record.state, loading: false })
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
    const view = this.createPageView()
    record.view = view
    view.webContents.on("did-start-loading", record.onStartLoading)
    view.webContents.on("did-stop-loading", record.onStopLoading)
    view.webContents.on("did-navigate", record.onNavigate)
    view.webContents.on("did-navigate-in-page", record.onNavigateInPage)
    view.webContents.on("page-title-updated", record.onTitleUpdated)
    view.webContents.on("page-favicon-updated", record.onFaviconUpdated)
    view.webContents.on("did-fail-load", record.onFailLoad)
    view.webContents.setWindowOpenHandler(record.onWindowOpen)
    for (const listener of this.pageViewCreatedListeners) listener(view)
    return view
  }

  private async navigate(id: TabId, input: string): Promise<void> {
    const record = this.tabs.get(id)
    if (!record) return

    const url = resolveNavigationUrl(input, this.pages)
    const internalPage = this.pages.resolve(url)
    if (internalPage) {
      this.destroyPage(record)
      this.updateTab(record, {
        ...record.state,
        kind: "internal",
        internalPage: internalPage.id,
        showInUrlBar: internalPage.showInUrlBar,
        url,
        title: internalPage.title,
        loading: false,
        canGoBack: false,
        canGoForward: false,
      })
      return
    }
    const view = this.ensureView(record)
    const nextState: BrowserTab = {
      ...record.state,
      kind: "web",
      internalPage: null,
      showInUrlBar: true,
      url,
      title: "Loading…",
      loading: true,
    }
    this.updateTab(record, nextState)
    if (this.activeTabId === id) {
      await this.activatePage(record)
      this.onPageViewChange(view)
    }
    await this.loadPage(record, url)
  }

  selectRelativeTab(offset: -1 | 1): void {
    const ids = [...this.tabs.keys()]
    if (ids.length < 2 || !this.activeTabId) return

    const currentIndex = ids.indexOf(this.activeTabId)
    const nextIndex = (currentIndex + offset + ids.length) % ids.length
    void this.selectTab(ids[nextIndex] as TabId)
  }

  private getSynchronizedState(record: TabRecord): BrowserTab {
    if (!record.view) return record.state
    const { webContents } = record.view
    const url = webContents.getURL()
    const title = webContents.getTitle()
    return {
      ...record.state,
      url: url || record.state.url,
      title: title || record.state.title,
      canGoBack: webContents.navigationHistory.canGoBack(),
      canGoForward: webContents.navigationHistory.canGoForward(),
    }
  }

  private updateTab(record: TabRecord, nextState: BrowserTab): void {
    if (this.areTabStatesEqual(record.state, nextState)) return
    const changes = this.getTabChanges(record.state, nextState)
    record.state = nextState
    this.onChange({ type: "tab-updated", tabId: nextState.id, changes })
  }

  private getTabChanges(first: BrowserTab, second: BrowserTab): BrowserTabChanges {
    const changes: BrowserTabChanges = {}
    if (first.kind !== second.kind) changes.kind = second.kind
    if (first.internalPage !== second.internalPage) changes.internalPage = second.internalPage
    if (first.showInUrlBar !== second.showInUrlBar) changes.showInUrlBar = second.showInUrlBar
    if (first.url !== second.url) changes.url = second.url
    if (first.title !== second.title) changes.title = second.title
    if (first.faviconUrl !== second.faviconUrl) changes.faviconUrl = second.faviconUrl ?? null
    if (first.loading !== second.loading) changes.loading = second.loading
    if (first.lifecycleState !== second.lifecycleState)
      changes.lifecycleState = second.lifecycleState
    if (first.canGoBack !== second.canGoBack) changes.canGoBack = second.canGoBack
    if (first.canGoForward !== second.canGoForward) changes.canGoForward = second.canGoForward
    return changes
  }

  private areTabStatesEqual(first: BrowserTab, second: BrowserTab): boolean {
    return (
      first.id === second.id &&
      first.kind === second.kind &&
      first.internalPage === second.internalPage &&
      first.showInUrlBar === second.showInUrlBar &&
      first.url === second.url &&
      first.title === second.title &&
      first.faviconUrl === second.faviconUrl &&
      first.loading === second.loading &&
      first.lifecycleState === second.lifecycleState &&
      first.canGoBack === second.canGoBack &&
      first.canGoForward === second.canGoForward
    )
  }

  private activeRecord(): TabRecord | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
  }

  private hideTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (id === this.activeTabId && record?.state.kind === "web" && record.view) {
      this.onPageViewChange(undefined)
      this.scheduleInactiveTab(record)
    }
  }

  private isTabActivated(id: TabId): boolean {
    const record = this.tabs.get(id)
    return record?.state.kind === "internal" || record?.view !== undefined
  }

  private isPageActive(record: TabRecord): boolean {
    return this.activeTabId === record.state.id && record.state.kind === "web"
  }

  private scheduleInactiveTab(record: TabRecord): void {
    this.clearInactiveTimer(record)
    if (!this.memorySaverSettings.enabled || !record.view) return

    record.inactiveTimer = setTimeout(() => {
      delete record.inactiveTimer
      this.freezePage(record)
    }, MEMORY_SAVER_DELAYS[this.memorySaverSettings.level])
  }

  private clearInactiveTimer(record: TabRecord): void {
    if (record.inactiveTimer === undefined) return
    clearTimeout(record.inactiveTimer)
    delete record.inactiveTimer
  }

  private activatePage(record: TabRecord): void {
    this.clearInactiveTimer(record)
    if (record.lifecycleState !== "frozen") return
    record.lifecycleState = "active"
    this.updateTab(record, { ...record.state, lifecycleState: "active" })
  }

  private freezePage(record: TabRecord): void {
    if (this.isPageActive(record)) return
    void this.discardPage(record)
  }

  private async discardPage(record: TabRecord): Promise<void> {
    const view = record.view
    if (this.isPageActive(record) || !view || record.lifecycleState === "frozen") return

    let savedPageStatePath: string | undefined
    try {
      savedPageStatePath = await savePageState(view.webContents)
      if (this.isPageActive(record) || record.view !== view) {
        await deletePageState(savedPageStatePath)
        return
      }

      record.savedPageStatePath = savedPageStatePath
      this.destroyPage(record, true)
      record.lifecycleState = "frozen"
      this.updateTab(record, { ...record.state, lifecycleState: "frozen" })
    } catch (error: unknown) {
      if (savedPageStatePath && record.view === view) await deletePageState(savedPageStatePath)
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "Photon memory saver failed to save page state: " +
            (error instanceof Error ? error.message : "Unknown error"),
        )
      }
    }
  }

  private async loadPage(record: TabRecord, url: string): Promise<void> {
    if (!record.view) return
    const savedPageStatePath = record.savedPageStatePath
    try {
      await record.view.webContents.loadURL(url)
      if (savedPageStatePath) await restorePageState(record.view.webContents, savedPageStatePath)
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        const message = error instanceof Error ? error.message : "Unknown navigation error"
        console.error("Navigation request failed: " + message)
      }
    } finally {
      if (savedPageStatePath && record.savedPageStatePath === savedPageStatePath) {
        record.savedPageStatePath = undefined
        await deletePageState(savedPageStatePath)
      }
    }
  }

  private focusSelectedTab(): void {
    const record = this.activeRecord()
    if (!record) return
    if (record.state.kind === "web" && record.view) this.onFocusPage(record.view)
    else this.onFocusOmnibox()
  }

  private destroyRecord(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return
    this.destroyPage(record)
    this.tabs.delete(id)
  }

  private destroyPage(record: TabRecord, preserveSavedPageState = false): void {
    this.clearInactiveTimer(record)
    const view = record.view
    if (!preserveSavedPageState && record.savedPageStatePath) {
      const savedPageStatePath = record.savedPageStatePath
      record.savedPageStatePath = undefined
      void deletePageState(savedPageStatePath).catch(() => undefined)
    }
    if (!view) return

    if (record.state.id === this.activeTabId) this.onPageViewChange(undefined)

    const { webContents } = view
    webContents.off("did-start-loading", record.onStartLoading)
    webContents.off("did-stop-loading", record.onStopLoading)
    webContents.off("did-navigate", record.onNavigate)
    webContents.off("did-navigate-in-page", record.onNavigateInPage)
    webContents.off("page-title-updated", record.onTitleUpdated)
    webContents.off("page-favicon-updated", record.onFaviconUpdated)
    webContents.off("did-fail-load", record.onFailLoad)
    if (webContents.debugger.isAttached()) webContents.debugger.detach()
    if (!webContents.isDestroyed()) webContents.close()
    delete record.view
  }
}
