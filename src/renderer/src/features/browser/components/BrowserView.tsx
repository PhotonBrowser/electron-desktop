import type { WebviewTag } from "electron"
import { memo, useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react"
import type { BrowserTab, TabId } from "@/shared/photon-api"
import { WEBVIEW_EVENTS } from "@/shared/webview-events"
import type { FindController } from "../../find/find.types"
import { useWebviewEvents } from "../hooks/useWebviewEvents"

interface BrowserViewProps {
  tab: BrowserTab
  active: boolean
  onFindControllerChange: (controller: FindController | null, tabId: TabId) => void
}

/** The renderer-owned boundary around one stable Electron DOM webview guest. */
export const BrowserView = memo(function BrowserView({
  tab,
  active,
  onFindControllerChange,
}: BrowserViewProps): React.JSX.Element | null {
  const webviewRef = useRef<WebviewTag>(null)
  const initialUrl = useRef(tab.url)
  const attachWebview = useCallback((webview: WebviewTag | null): void => {
    webviewRef.current = webview
    if (!webview) return

    // Electron requires popup opt-in before the guest is attached. The main
    // process still denies every unmanaged window and routes allowed URLs.
    webview.setAttribute("allowpopups", "")
    webview.setAttribute("src", initialUrl.current)
  }, [])
  const findController = useMemo<FindController>(
    () => ({
      tabId: tab.id,
      find: (query, forward) => {
        const webview = webviewRef.current
        if (!webview) return null
        return webview.findInPage(query, { findNext: true, forward })
      },
      stop: () => webviewRef.current?.stopFindInPage("clearSelection"),
      focus: () => {
        try {
          webviewRef.current?.focus()
        } catch {
          // A crashed or destroyed guest cannot receive focus.
        }
      },
      subscribe: (listener) => {
        const webview = webviewRef.current
        if (!webview) return () => undefined
        const handleFoundInPage = (event: Electron.FoundInPageEvent): void =>
          listener({
            requestId: event.result.requestId,
            activeMatchOrdinal: event.result.activeMatchOrdinal,
            matches: event.result.matches,
          })
        try {
          webview.addEventListener(WEBVIEW_EVENTS.foundInPage, handleFoundInPage)
        } catch {
          return () => undefined
        }
        return () => webview.removeEventListener(WEBVIEW_EVENTS.foundInPage, handleFoundInPage)
      },
    }),
    [tab.id],
  )
  useEffect(() => {
    if (!active || tab.lifecycleState === "frozen") return
    onFindControllerChange(findController, tab.id)
    return () => onFindControllerChange(null, tab.id)
  }, [active, findController, onFindControllerChange, tab.id, tab.lifecycleState])
  useWebviewEvents({ webviewRef, tab, active })

  if (tab.lifecycleState === "frozen") return null

  const style: CSSProperties = {
    visibility: active ? "visible" : "hidden",
    pointerEvents: active ? "auto" : "none",
  }

  return (
    <div className="photon-browser-view" style={style}>
      <webview
        ref={attachWebview}
        className="photon-webview"
        tabIndex={active ? 0 : -1}
        onFocus={() => {
          if (active) webviewRef.current?.focus()
        }}
      />
      {active && (tab.crashed || tab.error) ? (
        <div className="browser-error-state" role="alert">
          <strong>{tab.crashed ? "This tab has crashed" : "Unable to load this page"}</strong>
          {tab.error ? <span>{tab.error}</span> : null}
          <button
            className="photon-button"
            type="button"
            onClick={() => void window.photon.navigation.reload()}
          >
            Reload
          </button>
        </div>
      ) : null}
    </div>
  )
})
