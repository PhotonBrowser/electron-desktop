import type { BrowserTab, TabId } from "@/shared/photon-api"

export function areTabPropsEqual(previousTab: BrowserTab, nextTab: BrowserTab): boolean {
  return (
    previousTab.id === nextTab.id &&
    previousTab.url === nextTab.url &&
    previousTab.title === nextTab.title &&
    previousTab.faviconUrl === nextTab.faviconUrl &&
    previousTab.loading === nextTab.loading &&
    previousTab.lifecycleState === nextTab.lifecycleState &&
    previousTab.canGoBack === nextTab.canGoBack &&
    previousTab.canGoForward === nextTab.canGoForward
  )
}

export function hasSameTabOrder(first: readonly TabId[], second: readonly TabId[]): boolean {
  return first.length === second.length && first.every((tabId, index) => tabId === second[index])
}
