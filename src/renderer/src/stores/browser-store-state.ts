import type {
  BrowserTab,
  PhotonBrowserUpdateEnvelope,
  PhotonSnapshot,
  TabId,
} from "@/shared/photon-api"

export interface BrowserStateSnapshot {
  revision: number
  tabs: BrowserTab[]
  activeTabId: TabId
  isMaximized: boolean
}

export function applyBrowserSnapshot(
  current: BrowserStateSnapshot,
  snapshot: PhotonSnapshot,
): BrowserStateSnapshot {
  return snapshot.revision < current.revision ? current : snapshot
}

export function applyBrowserUpdates(
  current: BrowserStateSnapshot,
  updates: readonly PhotonBrowserUpdateEnvelope[],
): BrowserStateSnapshot {
  let next = current

  for (const envelope of updates) {
    if (envelope.revision <= next.revision) continue
    next = applyBrowserUpdate(next, envelope)
  }

  return next
}

function applyBrowserUpdate(
  current: BrowserStateSnapshot,
  envelope: PhotonBrowserUpdateEnvelope,
): BrowserStateSnapshot {
  const { update } = envelope
  if (update.type === "tab-added") {
    return { ...current, tabs: [...current.tabs, update.tab], revision: envelope.revision }
  }
  if (update.type === "tab-updated") {
    return applyTabUpdate(current, envelope)
  }
  if (update.type === "tab-removed") {
    return {
      ...current,
      tabs: current.tabs.filter((tab) => tab.id !== update.tabId),
      revision: envelope.revision,
    }
  }
  if (update.type === "tabs-reordered") {
    return {
      ...current,
      tabs: reorderTabs(current.tabs, update.tabIds),
      revision: envelope.revision,
    }
  }
  if (update.type === "active-tab-changed") {
    return { ...current, activeTabId: update.activeTabId, revision: envelope.revision }
  }
  return { ...current, isMaximized: update.isMaximized, revision: envelope.revision }
}

function applyTabUpdate(
  current: BrowserStateSnapshot,
  envelope: PhotonBrowserUpdateEnvelope,
): BrowserStateSnapshot {
  const update = envelope.update
  if (update.type !== "tab-updated") return current
  const tabIndex = current.tabs.findIndex((tab) => tab.id === update.tabId)
  const currentTab = current.tabs[tabIndex]
  if (tabIndex === -1 || !currentTab) return { ...current, revision: envelope.revision }

  const { faviconUrl, ...changes } = update.changes
  const nextTab: BrowserTab = { ...currentTab, ...changes }
  if (faviconUrl === null) delete nextTab.faviconUrl
  else if (faviconUrl !== undefined) nextTab.faviconUrl = faviconUrl

  return {
    ...current,
    tabs: [...current.tabs.slice(0, tabIndex), nextTab, ...current.tabs.slice(tabIndex + 1)],
    revision: envelope.revision,
  }
}

function reorderTabs(tabs: readonly BrowserTab[], tabIds: readonly TabId[]): BrowserTab[] {
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]))
  const orderedTabs = tabIds.flatMap((tabId) => {
    const tab = tabsById.get(tabId)
    if (!tab) return []
    tabsById.delete(tabId)
    return [tab]
  })
  return [...orderedTabs, ...tabsById.values()]
}
