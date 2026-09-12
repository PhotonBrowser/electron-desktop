import type {
  DidFailLoadEvent,
  DidNavigateEvent,
  DidNavigateInPageEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
  WebviewTag,
} from "electron"
import { useEffect, useRef, type RefObject } from "react"
import type {
  BrowserNavigationCommand,
  BrowserTab,
  PhotonWebviewEventChanges,
  TabId,
} from "@/shared/photon-api"
import { BROWSER_DEFAULTS } from "@/shared/browser-constants"
import { WEBVIEW_EVENTS } from "@/shared/webview-events"

interface UseWebviewEventsOptions {
  webviewRef: RefObject<WebviewTag | null>
  tab: BrowserTab
  active: boolean
}

/** Keeps one guest's Electron event lifecycle attached to its stable DOM webview. */
export function useWebviewEvents({ webviewRef, tab, active }: UseWebviewEventsOptions): void {
  const tabRef = useRef(tab)
  const activeRef = useRef(active)
  useEffect(() => {
    tabRef.current = tab
    activeRef.current = active
  }, [active, tab])

  useEffect(() => {
    if (tab.lifecycleState === "frozen") return
    const webview = webviewRef.current
    if (!webview) return

    const update = (changes: PhotonWebviewEventChanges): void => {
      // A guest can be destroyed while its last event is crossing the preload boundary.
      void window.photon.tabs.update(tabRef.current.id, changes).catch(() => undefined)
    }
    const syncHistory = (): void => {
      update({ canGoBack: webview.canGoBack(), canGoForward: webview.canGoForward() })
    }
    const handleStartLoading = (): void => update({ loading: true, crashed: false, error: null })
    const handleStopLoading = (): void => {
      syncHistory()
      update({ loading: false })
    }
    const handleNavigate = (event: DidNavigateEvent): void => {
      if (event.url) update({ url: event.url, error: null, crashed: false })
      syncHistory()
    }
    const handleNavigateInPage = (event: DidNavigateInPageEvent): void => {
      if (!event.isMainFrame) return
      if (event.url) update({ url: event.url })
      syncHistory()
    }
    const handleTitleUpdated = (event: PageTitleUpdatedEvent): void => {
      update({ title: event.title || BROWSER_DEFAULTS.newTabTitle })
    }
    const handleFaviconUpdated = (event: PageFaviconUpdatedEvent): void => {
      update({ faviconUrl: event.favicons[0] ?? null })
    }
    const handleDomReady = (): void => {
      update({
        url: webview.getURL() || tabRef.current.url,
        title: webview.getTitle() || tabRef.current.title,
      })
      syncHistory()
      if (activeRef.current) webview.focus()
    }
    const handleFailLoad = (event: DidFailLoadEvent): void => {
      if (!event.isMainFrame) return
      update({
        loading: false,
        error: event.errorCode === -3 ? null : event.errorDescription || "Unable to load this page",
      })
    }
    const handleRenderProcessGone = (): void => {
      update({ loading: false, crashed: true, error: null })
    }
    const handleCommand = (tabId: TabId, command: BrowserNavigationCommand): void => {
      if (tabId !== tabRef.current.id) return
      if (command === "back") webview.goBack()
      else if (command === "forward") webview.goForward()
      else if (command === "reload") webview.reload()
      else if (command === "stop") webview.stop()
      else if (command === "devtools") {
        if (import.meta.env.DEV) webview.openDevTools()
      } else {
        webview.focus()
      }
    }

    webview.addEventListener(WEBVIEW_EVENTS.didStartLoading, handleStartLoading)
    webview.addEventListener(WEBVIEW_EVENTS.didStopLoading, handleStopLoading)
    webview.addEventListener(WEBVIEW_EVENTS.didNavigate, handleNavigate)
    webview.addEventListener(WEBVIEW_EVENTS.didNavigateInPage, handleNavigateInPage)
    webview.addEventListener(WEBVIEW_EVENTS.pageTitleUpdated, handleTitleUpdated)
    webview.addEventListener(WEBVIEW_EVENTS.pageFaviconUpdated, handleFaviconUpdated)
    webview.addEventListener(WEBVIEW_EVENTS.domReady, handleDomReady)
    webview.addEventListener(WEBVIEW_EVENTS.didFailLoad, handleFailLoad)
    webview.addEventListener(WEBVIEW_EVENTS.renderProcessGone, handleRenderProcessGone)
    const unsubscribeCommand = window.photon.onNavigationCommand(handleCommand)

    return () => {
      webview.removeEventListener(WEBVIEW_EVENTS.didStartLoading, handleStartLoading)
      webview.removeEventListener(WEBVIEW_EVENTS.didStopLoading, handleStopLoading)
      webview.removeEventListener(WEBVIEW_EVENTS.didNavigate, handleNavigate)
      webview.removeEventListener(WEBVIEW_EVENTS.didNavigateInPage, handleNavigateInPage)
      webview.removeEventListener(WEBVIEW_EVENTS.pageTitleUpdated, handleTitleUpdated)
      webview.removeEventListener(WEBVIEW_EVENTS.pageFaviconUpdated, handleFaviconUpdated)
      webview.removeEventListener(WEBVIEW_EVENTS.domReady, handleDomReady)
      webview.removeEventListener(WEBVIEW_EVENTS.didFailLoad, handleFailLoad)
      webview.removeEventListener(WEBVIEW_EVENTS.renderProcessGone, handleRenderProcessGone)
      unsubscribeCommand()
    }
  }, [tab.id, tab.lifecycleState, webviewRef])
}
