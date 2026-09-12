import { memo, useState } from "react"
import { Asterisk, BedDouble, Globe2, LoaderCircle, X } from "lucide-react"
import { BROWSER_DEFAULTS } from "@/shared/browser-constants"
import type { BrowserTab } from "@/shared/photon-api"
import { IconButton } from "@/renderer/src/ui/IconButton"
import { useBrowserStore } from "@/renderer/src/stores/browser-store"
import { areTabPropsEqual } from "../tab-utils"

interface TabProps {
  tab: BrowserTab
}

export const Tab = memo(
  function Tab({ tab }: TabProps): React.JSX.Element {
    const isActive = useBrowserStore((state) => state.activeTabId === tab.id)

    return (
      <div
        aria-selected={isActive}
        className={isActive ? "photon-tab photon-tab-active" : "photon-tab photon-tab-inactive"}
        role="tab"
        tabIndex={0}
        onClick={() => void window.photon.tabs.select(tab.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            void window.photon.tabs.select(tab.id)
          }
        }}
      >
        <span aria-hidden="true" className="photon-tab-active-background" />
        <span className="photon-tab-content z-10">
          <span className="photon-tab-icon">
            {tab.lifecycleState === "frozen" ? (
              <BedDouble aria-label="Suspended tab" size={12} />
            ) : tab.loading ? (
              <LoaderCircle aria-label="Loading" className="animate-spin" size={12} />
            ) : tab.kind === "internal" ? (
              <Asterisk aria-label="Photon" size={12} />
            ) : (
              <WebTabIcon key={`${tab.url}:${tab.faviconUrl ?? ""}`} faviconUrl={tab.faviconUrl} />
            )}
          </span>
          <span className="photon-tab-title">{tab.title || BROWSER_DEFAULTS.newTabTitle}</span>
          <IconButton
            ariaLabel="Close tab"
            className="photon-tab-close"
            size="sm"
            variant="ghost"
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onPress={() => {
              void window.photon.tabs.close(tab.id)
            }}
          >
            <X aria-hidden="true" size={12} />
          </IconButton>
        </span>
      </div>
    )
  },
  (previous, next) => areTabPropsEqual(previous.tab, next.tab),
)

function WebTabIcon({ faviconUrl }: { faviconUrl: string | undefined }): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (!faviconUrl || failed) return <Globe2 aria-hidden="true" size={12} />

  return (
    <img
      alt=""
      className="photon-tab-favicon"
      height={12}
      src={faviconUrl}
      width={12}
      onError={() => setFailed(true)}
    />
  )
}
