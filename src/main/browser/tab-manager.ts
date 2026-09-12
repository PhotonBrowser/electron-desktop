import type {
  BrowserNavigationCommand,
  BrowserTab,
  BrowserTabChanges,
  MemorySaverSettings,
  PhotonNavigationRequest,
  PhotonBrowserUpdate,
  TabId,
} from "@/shared/photon-api"
import { type InternalPageRegistry } from "./internal-pages.mts"
import { TabLifecycle, type TabRecord } from "./tab-lifecycle.ts"
import {
  applyWebviewChanges,
  areBrowserTabsEqual,
  createBrowserTab,
  createNavigatedTab,
  getBrowserTabChanges,
} from "./tab-state.ts"

type CloseLastTabAction = "close-window" | "new-tab"
const CLOSE_LAST_TAB_ACTION: CloseLastTabAction = "close-window"

export interface TabManagerSnapshot {
  tabs: BrowserTab[]
  activeTabId: TabId
}

export interface TabManagerDiagnostics {
  activeTabId: TabId | null
  tabs: Array<{
    tabId: TabId
    webviewMounted: boolean
  }>
}

type StateListener = (update: PhotonBrowserUpdate) => void
type FocusPageListener = (tabId: TabId) => void
type NavigationCommandListener = (request: PhotonNavigationRequest) => void

interface ClosedTab {
  url: string
  title: string
}

export interface TabManagerOptions {
  onChange: StateListener
  onFocusOmnibox: () => void
  onFocusPage: FocusPageListener
  onNavigationCommand: NavigationCommandListener
  onCloseWindow: () => void
  pages: InternalPageRegistry
}

export class TabManager {
  private readonly onChange: StateListener
  private readonly onFocusOmnibox: () => void
  private readonly onFocusPage: FocusPageListener
  private readonly onNavigationCommand: NavigationCommandListener
  private readonly onCloseWindow: () => void
  private readonly pages: InternalPageRegistry
  private readonly tabs = new Map<TabId, TabRecord>()
  private readonly lifecycle: TabLifecycle
  private readonly recentlyClosedTabs: ClosedTab[] = []
  private activeTabId: TabId | null = null
  private nextTabNumber = 1

  constructor(options: TabManagerOptions) {
    this.onChange = options.onChange
    this.onFocusOmnibox = options.onFocusOmnibox
    this.onFocusPage = options.onFocusPage
    this.onNavigationCommand = options.onNavigationCommand
    this.onCloseWindow = options.onCloseWindow
    this.pages = options.pages
    this.lifecycle = new TabLifecycle(
      (record, nextState) => this.updateTab(record, nextState),
      (record) => this.activeTabId === record.state.id && record.state.kind === "web",
    )
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
      // Guest web contents belong to the chrome renderer now. Main can report
      // tab identity, but it deliberately does not retain guest references.
      tabs: [...this.tabs.values()].map((record) => ({
        tabId: record.state.id,
        webviewMounted: record.state.kind === "web" && record.state.lifecycleState === "active",
      })),
    }
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
    this.recentlyClosedTabs.push({ url: record.state.url, title: record.state.title })
    this.destroyRecord(id)
    this.onChange({ type: "tab-removed", tabId: id })
    if (!wasActive || !nextId) return

    const previousActiveTabId = this.activeTabId
    void this.activateTab(nextId).then(() => this.focusSelectedTab())
    if (this.activeTabId !== previousActiveTabId) {
      this.onChange({ type: "active-tab-changed", activeTabId: nextId })
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
    this.sendNavigationCommand("back")
  }

  forward(): void {
    this.sendNavigationCommand("forward")
  }

  reload(): void {
    this.sendNavigationCommand("reload")
  }

  stopLoading(): void {
    this.sendNavigationCommand("stop")
  }

  toggleDevTools(): void {
    this.sendNavigationCommand("devtools")
  }

  closeActiveTab(): void {
    if (this.activeTabId) this.closeTab(this.activeTabId)
  }

  reopenClosedTab(): void {
    const closedTab = this.recentlyClosedTabs.pop()
    if (!closedTab) return

    const tabId = this.createTab(closedTab.url, false)
    const record = this.tabs.get(tabId)
    if (record) this.updateTab(record, { ...record.state, title: closedTab.title })
  }

  setMemorySaverSettings(settings: MemorySaverSettings): void {
    this.lifecycle.setSettings(settings, this.tabs.values())
  }

  async navigateActive(input: string): Promise<void> {
    if (this.activeTabId) this.navigate(this.activeTabId, input)
  }

  async activateTab(id: TabId): Promise<void> {
    const record = this.tabs.get(id)
    if (!record) return
    if (id === this.activeTabId && this.isTabActivated(id)) return

    if (this.activeTabId && this.activeTabId !== id) this.hideTab(this.activeTabId)
    this.activeTabId = id
    this.activatePage(record)
  }

  dispose(): void {
    for (const id of [...this.tabs.keys()]) this.destroyRecord(id)
    this.tabs.clear()
    this.activeTabId = null
  }

  updateFromWebview(tabId: TabId, changes: BrowserTabChanges): void {
    const record = this.tabs.get(tabId)
    if (!record || record.state.kind !== "web") return

    this.updateTab(record, applyWebviewChanges(record.state, changes))
  }

  selectRelativeTab(offset: -1 | 1): void {
    const ids = [...this.tabs.keys()]
    if (ids.length < 2 || !this.activeTabId) return

    const currentIndex = ids.indexOf(this.activeTabId)
    const nextIndex = (currentIndex + offset + ids.length) % ids.length
    const nextTabId = ids[nextIndex]
    if (nextTabId) void this.selectTab(nextTabId)
  }

  private createRecord(id: TabId, url: string): TabRecord {
    return {
      state: createBrowserTab(id, url, this.pages),
    }
  }

  private navigate(id: TabId, input: string): void {
    const record = this.tabs.get(id)
    if (!record) return

    const wasWebTab = record.state.kind === "web"
    const nextState = createNavigatedTab(record.state, input, this.pages)
    if (nextState.kind === "internal") {
      this.lifecycle.clear(record)
      this.updateTab(record, nextState)
      return
    }

    this.activatePage(record)
    this.updateTab(record, nextState)
    if (wasWebTab) this.onNavigationCommand({ tabId: id, command: "navigate", url: nextState.url })
  }

  private sendNavigationCommand(
    command: Exclude<BrowserNavigationCommand, "focus" | "navigate">,
  ): void {
    const record = this.activeRecord()
    if (!record || record.state.kind !== "web") return
    if (command === "back" && !record.state.canGoBack) return
    if (command === "forward" && !record.state.canGoForward) return
    this.onNavigationCommand({ tabId: record.state.id, command })
  }

  private updateTab(record: TabRecord, nextState: BrowserTab): void {
    if (areBrowserTabsEqual(record.state, nextState)) return
    const changes = getBrowserTabChanges(record.state, nextState)
    record.state = nextState
    this.onChange({ type: "tab-updated", tabId: nextState.id, changes })
  }

  private activeRecord(): TabRecord | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
  }

  private hideTab(id: TabId): void {
    const record = this.tabs.get(id)
    if (record?.state.kind === "web") this.lifecycle.schedule(record)
  }

  private isTabActivated(id: TabId): boolean {
    const record = this.tabs.get(id)
    return record?.state.kind === "internal" || record?.state.lifecycleState === "active"
  }

  private activatePage(record: TabRecord): void {
    this.lifecycle.activate(record)
    if (this.activeTabId !== record.state.id) return
    if (record.state.kind === "web") this.onFocusPage(record.state.id)
    else this.onFocusOmnibox()
  }

  private focusSelectedTab(): void {
    const record = this.activeRecord()
    if (!record) return
    if (record.state.kind === "web") this.onFocusPage(record.state.id)
    else this.onFocusOmnibox()
  }

  private destroyRecord(id: TabId): void {
    const record = this.tabs.get(id)
    if (!record) return
    this.lifecycle.clear(record)
    this.tabs.delete(id)
  }
}
