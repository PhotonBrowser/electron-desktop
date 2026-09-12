import type {
  DidFailLoadEvent,
  DidNavigateEvent,
  DidNavigateInPageEvent,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
  WebviewTag,
} from "electron"
import type { BrowserNavigationCommand, BrowserTab, TabId } from "@/preload/photon-api"
import { useEffect, useRef, type CSSProperties } from "react"

interface BrowserViewProps {
  tab: BrowserTab
  active: boolean
}

/**
 * The only React component that knows about the Electron webview element.
 * Each mounted web tab keeps its own guest alive while another tab is active.
 */
export function BrowserView({ tab, active }: BrowserViewProps): React.JSX.Element | null {
  const webviewRef = useRef<WebviewTag>(null)
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

    const update = (changes: Parameters<typeof window.photon.tabs.update>[1]): void => {
      void window.photon.tabs.update(tabRef.current.id, changes).catch(() => undefined)
    }
    const syncHistory = (): void => {
      update({
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward(),
      })
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
      update({ title: event.title || "New Tab" })
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
      } else webview.focus()
    }

    webview.addEventListener("did-start-loading", handleStartLoading)
    webview.addEventListener("did-stop-loading", handleStopLoading)
    webview.addEventListener("did-navigate", handleNavigate)
    webview.addEventListener("did-navigate-in-page", handleNavigateInPage)
    webview.addEventListener("page-title-updated", handleTitleUpdated)
    webview.addEventListener("page-favicon-updated", handleFaviconUpdated)
    webview.addEventListener("dom-ready", handleDomReady)
    webview.addEventListener("did-fail-load", handleFailLoad)
    webview.addEventListener("render-process-gone", handleRenderProcessGone)
    const unsubscribeCommand = window.photon.onNavigationCommand(handleCommand)

    return () => {
      webview.removeEventListener("did-start-loading", handleStartLoading)
      webview.removeEventListener("did-stop-loading", handleStopLoading)
      webview.removeEventListener("did-navigate", handleNavigate)
      webview.removeEventListener("did-navigate-in-page", handleNavigateInPage)
      webview.removeEventListener("page-title-updated", handleTitleUpdated)
      webview.removeEventListener("page-favicon-updated", handleFaviconUpdated)
      webview.removeEventListener("dom-ready", handleDomReady)
      webview.removeEventListener("did-fail-load", handleFailLoad)
      webview.removeEventListener("render-process-gone", handleRenderProcessGone)
      unsubscribeCommand()
    }
  }, [tab.id, tab.lifecycleState])

  if (tab.lifecycleState === "frozen") return null

  const style: CSSProperties = {
    visibility: active ? "visible" : "hidden",
    pointerEvents: active ? "auto" : "none",
  }

  return (
    <div className="photon-browser-view" style={style}>
      <webview
        ref={webviewRef}
        className="photon-webview"
        src={tab.url}
        tabIndex={active ? 0 : -1}
        onFocus={() => {
          if (active) webviewRef.current?.focus()
        }}
      />
      {active && (tab.crashed || tab.error) ? (
        <div className="browser-error-state" role="alert">
          <strong>{tab.crashed ? "This tab has crashed" : "Unable to load this page"}</strong>
          {tab.error ? <span>{tab.error}</span> : null}
          <button type="button" onClick={() => void window.photon.navigation.reload()}>
            Reload
          </button>
        </div>
      ) : null}
    </div>
  )
}
