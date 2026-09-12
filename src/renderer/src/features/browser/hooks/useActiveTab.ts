import type { BrowserTab, TabId } from "@/shared/photon-api"
import { useBrowserStore } from "@/renderer/src/stores/browser-store"

export function useActiveTabId(): TabId {
  return useBrowserStore((state) => state.activeTabId)
}

export function useActiveTab(): BrowserTab | undefined {
  return useBrowserStore((state) => state.tabs.find((tab) => tab.id === state.activeTabId))
}
