import type { BrowserTab, BrowserTabChanges, TabId } from "@/preload/photon-api"
import { type InternalPageRegistry, resolveTabKind } from "./internal-pages.mts"

export function createBrowserTab(id: TabId, url: string, pages: InternalPageRegistry): BrowserTab {
  const internalPage = pages.resolve(url)
  return {
    id,
    kind: resolveTabKind(url, pages),
    internalPage: internalPage?.id ?? null,
    showInUrlBar: internalPage?.showInUrlBar ?? true,
    url,
    title: internalPage?.title ?? "Loading…",
    loading: resolveTabKind(url, pages) === "web",
    lifecycleState: "active",
    canGoBack: false,
    canGoForward: false,
    crashed: false,
    error: null,
  }
}

export function getBrowserTabChanges(first: BrowserTab, second: BrowserTab): BrowserTabChanges {
  const changes: BrowserTabChanges = {}
  if (first.kind !== second.kind) changes.kind = second.kind
  if (first.internalPage !== second.internalPage) changes.internalPage = second.internalPage
  if (first.showInUrlBar !== second.showInUrlBar) changes.showInUrlBar = second.showInUrlBar
  if (first.url !== second.url) changes.url = second.url
  if (first.title !== second.title) changes.title = second.title
  if (first.faviconUrl !== second.faviconUrl) changes.faviconUrl = second.faviconUrl ?? null
  if (first.loading !== second.loading) changes.loading = second.loading
  if (first.lifecycleState !== second.lifecycleState) changes.lifecycleState = second.lifecycleState
  if (first.canGoBack !== second.canGoBack) changes.canGoBack = second.canGoBack
  if (first.canGoForward !== second.canGoForward) changes.canGoForward = second.canGoForward
  if (first.crashed !== second.crashed) changes.crashed = second.crashed
  if (first.error !== second.error) changes.error = second.error
  return changes
}

export function areBrowserTabsEqual(first: BrowserTab, second: BrowserTab): boolean {
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
    first.canGoForward === second.canGoForward &&
    first.crashed === second.crashed &&
    first.error === second.error
  )
}
