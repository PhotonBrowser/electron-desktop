import type { WebviewTag } from "electron"
import { memo, useRef, type CSSProperties } from "react"
import type { BrowserTab } from "@/shared/photon-api"
import { useWebviewEvents } from "../hooks/useWebviewEvents"

interface BrowserViewProps {
  tab: BrowserTab
  active: boolean
}

/** The renderer-owned boundary around one stable Electron DOM webview guest. */
export const BrowserView = memo(function BrowserView({
  tab,
  active,
}: BrowserViewProps): React.JSX.Element | null {
  const webviewRef = useRef<WebviewTag>(null)
  useWebviewEvents({ webviewRef, tab, active })

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
})
