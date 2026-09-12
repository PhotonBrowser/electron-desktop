import { Input } from "@heroui/react"
import {
  Asterisk,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  LockKeyhole,
  RotateCw,
  ShieldAlert,
  X,
} from "lucide-react"
import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react"
import { getSiteSecurity } from "@/shared/site-security"
import { IconButton } from "../ui/IconButton"
import { useBrowserStore } from "../stores/browser-store"
import { useClickOutside } from "../../hooks/useClickOutside"

interface ToolbarProps {
  addressInput: RefObject<HTMLInputElement | null>
}

export function Toolbar({ addressInput }: ToolbarProps): React.JSX.Element {
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const [draftAddress, setDraftAddress] = useState("")
  const [editingTabId, setEditingTabId] = useState<typeof activeTabId | null>(null)
  const [siteSecurityOpen, setSiteSecurityOpen] = useState(false)
  const [siteSecurityOrigin, setSiteSecurityOrigin] = useState({ left: 8, top: 74 })
  const siteSecurityButton = useRef<HTMLButtonElement>(null)
  const siteSecurity = activeTab?.showInUrlBar === true ? getSiteSecurity(activeTab.url) : null
  const siteSecurityPopover = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!siteSecurityOpen) return
    const updateOrigin = (): void => {
      const bounds = siteSecurityButton.current?.getBoundingClientRect()
      if (!bounds) return
      setSiteSecurityOrigin({
        left: Math.max(8, Math.round(bounds.left - 8)),
        top: Math.round(bounds.bottom + 6),
      })
    }
    updateOrigin()
    window.addEventListener("resize", updateOrigin)
    return () => window.removeEventListener("resize", updateOrigin)
  }, [siteSecurityOpen])

  useClickOutside(
    siteSecurityPopover,
    () => {
      setSiteSecurityOpen(false)
    },
    siteSecurityOpen,
  )

  const toggleSiteSecurity = (): void => {
    if (!siteSecurity) return
    if (siteSecurityOpen) {
      setSiteSecurityOpen(false)
      return
    }

    const buttonBounds = siteSecurityButton.current?.getBoundingClientRect()
    if (!buttonBounds) return

    setSiteSecurityOrigin({
      left: Math.max(8, Math.round(buttonBounds.left - 8)),
      top: Math.round(buttonBounds.bottom + 6),
    })
    setSiteSecurityOpen(true)
  }

  const submitAddress = (): void => {
    setEditingTabId(null)
    addressInput.current?.blur()
    void window.photon.navigation.navigate(draftAddress)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submitAddress()
  }

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setEditingTabId(null)
      addressInput.current?.blur()
    }
  }

  const isEditingActiveTab = editingTabId === activeTabId
  const isLoading = activeTab?.loading === true

  return (
    <>
      <header className="photon-toolbar">
        <div className="photon-navigation-controls">
          <IconButton
            ariaLabel="Back"
            className="photon-toolbar-button"
            isDisabled={!activeTab?.canGoBack}
            size="sm"
            variant="ghost"
            onPress={() => void window.photon.navigation.back()}
          >
            <ArrowLeft aria-hidden="true" size={19} />
          </IconButton>
          <IconButton
            ariaLabel="Forward"
            className="photon-toolbar-button"
            isDisabled={!activeTab?.canGoForward}
            size="sm"
            variant="ghost"
            onPress={() => void window.photon.navigation.forward()}
          >
            <ArrowRight aria-hidden="true" size={19} />
          </IconButton>
          <IconButton
            ariaLabel={isLoading ? "Stop loading" : "Reload"}
            className="photon-toolbar-button"
            size="sm"
            variant="ghost"
            onPress={() =>
              void (isLoading ? window.photon.navigation.stop() : window.photon.navigation.reload())
            }
          >
            {isLoading ? (
              <X aria-hidden="true" size={19} />
            ) : (
              <RotateCw aria-hidden="true" size={19} />
            )}
          </IconButton>
        </div>
        <form className="photon-omnibox-form" onSubmit={handleSubmit}>
          <div className="photon-omnibox-wrap">
            <IconButton
              ref={siteSecurityButton}
              ariaLabel="Site information"
              aria-haspopup="dialog"
              aria-expanded={siteSecurityOpen}
              className="photon-address-icon-button z-10"
              isDisabled={!siteSecurity}
              size="sm"
              type="button"
              variant="ghost"
              onPress={toggleSiteSecurity}
            >
              <Asterisk aria-hidden="true" size={20} strokeWidth={2.5} />
            </IconButton>
            <Input
              ref={addressInput}
              aria-label="Address"
              className="photon-address-input"
              value={
                isEditingActiveTab
                  ? draftAddress
                  : activeTab?.showInUrlBar === false
                    ? ""
                    : (activeTab?.url ?? "")
              }
              placeholder="Search Google or enter a URL"
              variant="secondary"
              onBlur={() => setEditingTabId(null)}
              onChange={(event) => {
                setEditingTabId(activeTabId)
                setDraftAddress(event.target.value)
              }}
              onFocus={(event) => {
                const address = activeTab?.showInUrlBar === false ? "" : (activeTab?.url ?? "")
                setDraftAddress(address)
                setEditingTabId(activeTabId)
                if (address) event.currentTarget.select()
              }}
              onKeyDown={handleAddressKeyDown}
            />
          </div>
        </form>
      </header>
      {siteSecurityOpen && siteSecurity && (
        <div className="browser-overlay-layer">
          <section
            ref={siteSecurityPopover}
            aria-label={`Site information for ${siteSecurity.host}`}
            className="photon-site-security-popover z-50"
            role="dialog"
            style={{ left: siteSecurityOrigin.left, top: siteSecurityOrigin.top }}
          >
            <div className="photon-site-security-header">
              <strong>{siteSecurity.host}</strong>
              <button
                aria-label="Close site information"
                className="photon-site-security-close"
                type="button"
                onClick={() => {
                  setSiteSecurityOpen(false)
                }}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <div className="photon-site-security-row">
              {siteSecurity.isSecure ? (
                <LockKeyhole aria-hidden="true" size={19} strokeWidth={1.8} />
              ) : (
                <ShieldAlert aria-hidden="true" size={19} strokeWidth={1.8} />
              )}
              <span>
                {siteSecurity.isSecure ? "Connection is secure" : "Connection is not secure"}
              </span>
              <ChevronRight aria-hidden="true" className="photon-site-security-chevron" size={18} />
            </div>
          </section>
        </div>
      )}
    </>
  )
}
