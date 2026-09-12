import { BROWSER_DEFAULTS } from "../../shared/browser-constants.ts"
import type { BrowserTab, BrowserTabChanges, TabId } from "@/shared/photon-api"
import { type InternalPageRegistry, resolveTabKind } from "./internal-pages.mts"
import { resolveNavigationUrl } from "./navigation-url.mts"

export function createBrowserTab(id: TabId, url: string, pages: InternalPageRegistry): BrowserTab {
  const kind = resolveTabKind(url, pages)
  const internalPage = pages.resolve(url)
  return {
    id,
    kind,
    internalPage: internalPage?.id ?? null,
    showInUrlBar: internalPage?.showInUrlBar ?? true,
    url,
    title: internalPage?.title ?? BROWSER_DEFAULTS.loadingTitle,
    loading: kind === "web",
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

export function createNavigatedTab(
  current: BrowserTab,
  input: string,
  pages: InternalPageRegistry,
): BrowserTab {
  const url = resolveNavigationUrl(input, pages)
  const internalPage = pages.resolve(url)
  if (internalPage) {
    return {
      ...current,
      kind: "internal",
      internalPage: internalPage.id,
      showInUrlBar: internalPage.showInUrlBar,
      url,
      title: internalPage.title,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      crashed: false,
      error: null,
      lifecycleState: "active",
    }
  }

  return {
    ...current,
    kind: "web",
    internalPage: null,
    showInUrlBar: true,
    url,
    title: BROWSER_DEFAULTS.loadingTitle,
    loading: true,
    crashed: false,
    error: null,
    lifecycleState: "active",
  }
}

export function applyWebviewChanges(current: BrowserTab, changes: BrowserTabChanges): BrowserTab {
  const nextState: BrowserTab = {
    ...current,
    kind: "web",
    internalPage: null,
    showInUrlBar: true,
  }
  if (changes.url !== undefined) nextState.url = changes.url
  if (changes.title !== undefined) nextState.title = changes.title
  if (changes.loading !== undefined) nextState.loading = changes.loading
  if (changes.canGoBack !== undefined) nextState.canGoBack = changes.canGoBack
  if (changes.canGoForward !== undefined) nextState.canGoForward = changes.canGoForward
  if (changes.crashed !== undefined) nextState.crashed = changes.crashed
  if (changes.error !== undefined) nextState.error = changes.error
  if (changes.faviconUrl === null) delete nextState.faviconUrl
  else if (changes.faviconUrl !== undefined) nextState.faviconUrl = changes.faviconUrl
  return nextState
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
