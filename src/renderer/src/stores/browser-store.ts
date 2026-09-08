import { create } from "zustand"
import type {
  BrowserTab,
  MemorySaverLevel,
  PhotonBrowserUpdateEnvelope,
  PhotonSnapshot,
  TabId,
} from "@/preload/photon-api"

interface BrowserStore {
  revision: number
  tabs: BrowserTab[]
  activeTabId: TabId
  isMaximized: boolean
  themeMode: ThemeMode
  memorySaverEnabled: boolean
  memorySaverLevel: MemorySaverLevel
  setThemeMode: (themeMode: ThemeMode) => void
  setMemorySaverEnabled: (enabled: boolean) => void
  setMemorySaverLevel: (level: MemorySaverLevel) => void
  applySnapshot: (snapshot: PhotonSnapshot) => void
  applyUpdates: (updates: PhotonBrowserUpdateEnvelope[]) => void
}

export type ThemeMode = "system" | "light" | "dark"

function getInitialThemeMode(): ThemeMode {
  const saved = window.localStorage.getItem("photon-theme-mode")
  return saved === "light" || saved === "dark" ? saved : "system"
}

function getInitialMemorySaverEnabled(): boolean {
  return window.localStorage.getItem("photon-memory-saver-enabled") !== "false"
}

function getInitialMemorySaverLevel(): MemorySaverLevel {
  const saved = window.localStorage.getItem("photon-memory-saver-level")
  return saved === "moderate" || saved === "maximum" ? saved : "balanced"
}

export const useBrowserStore = create<BrowserStore>((set) => ({
  revision: 0,
  tabs: [],
  activeTabId: "tab-1" as TabId,
  isMaximized: false,
  themeMode: getInitialThemeMode(),
  memorySaverEnabled: getInitialMemorySaverEnabled(),
  memorySaverLevel: getInitialMemorySaverLevel(),
  setThemeMode: (themeMode) => {
    window.localStorage.setItem("photon-theme-mode", themeMode)
    set({ themeMode })
  },
  setMemorySaverEnabled: (memorySaverEnabled) => {
    window.localStorage.setItem("photon-memory-saver-enabled", String(memorySaverEnabled))
    set({ memorySaverEnabled })
  },
  setMemorySaverLevel: (memorySaverLevel) => {
    window.localStorage.setItem("photon-memory-saver-level", memorySaverLevel)
    set({ memorySaverLevel })
  },
  applySnapshot: (snapshot) =>
    set((state) => (snapshot.revision < state.revision ? state : snapshot)),
  applyUpdates: (updates) =>
    set((state) => {
      let tabs = state.tabs
      let activeTabId = state.activeTabId
      let isMaximized = state.isMaximized
      let revision = state.revision

      for (const { revision: updateRevision, update } of updates) {
        if (updateRevision <= revision) continue
        revision = updateRevision

        if (update.type === "tab-added") {
          tabs = [...tabs, update.tab]
        } else if (update.type === "tab-updated") {
          const tabIndex = tabs.findIndex((tab) => tab.id === update.tabId)
          const currentTab = tabs[tabIndex]
          if (tabIndex === -1 || !currentTab) {
            continue
          } else {
            const { faviconUrl, ...changes } = update.changes
            const nextTab: BrowserTab = { ...currentTab, ...changes }
            if (faviconUrl === null) delete nextTab.faviconUrl
            else if (faviconUrl !== undefined) nextTab.faviconUrl = faviconUrl
            tabs = [...tabs.slice(0, tabIndex), nextTab, ...tabs.slice(tabIndex + 1)]
          }
        } else if (update.type === "tab-removed") {
          tabs = tabs.filter((tab) => tab.id !== update.tabId)
        } else if (update.type === "tabs-reordered") {
          const tabsById = new Map(tabs.map((tab) => [tab.id, tab]))
          const orderedTabs = update.tabIds.flatMap((tabId) => {
            const tab = tabsById.get(tabId)
            if (!tab) return []
            tabsById.delete(tabId)
            return [tab]
          })
          tabs = [...orderedTabs, ...tabsById.values()]
        } else if (update.type === "active-tab-changed") {
          activeTabId = update.activeTabId
        } else {
          isMaximized = update.isMaximized
        }
      }

      if (revision === state.revision) return state
      return { tabs, activeTabId, isMaximized, revision }
    }),
}))
