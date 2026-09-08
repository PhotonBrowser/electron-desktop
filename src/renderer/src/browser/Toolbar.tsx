import { Input } from "@heroui/react"
import { Asterisk, ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react"
import { getSiteSecurity } from "@/shared/site-security"
import { IconButton } from "../ui/IconButton"
import { useBrowserStore } from "../stores/browser-store"

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
  const siteSecurityButton = useRef<HTMLButtonElement>(null)
  const siteSecurity = activeTab?.showInUrlBar === true ? getSiteSecurity(activeTab.url) : null

  useEffect(() => window.photon.overlay.onHidden(() => setSiteSecurityOpen(false)), [])

  useEffect(() => {
    void window.photon.overlay.hide()
  }, [activeTabId, activeTab?.url])

  const toggleSiteSecurity = (): void => {
    if (!siteSecurity) return
    if (siteSecurityOpen) {
      void window.photon.overlay.hide()
      return
    }

    const buttonBounds = siteSecurityButton.current?.getBoundingClientRect()
    if (!buttonBounds) return

    setSiteSecurityOpen(true)
    void window.photon.overlay
      .showSiteSecurity(
        {
          x: Math.max(8, Math.round(buttonBounds.left - 8)),
          y: Math.round(buttonBounds.bottom + 6),
          width: 320,
          height: 128,
        },
        siteSecurity,
      )
      .catch(() => setSiteSecurityOpen(false))
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
            className="photon-address-icon-button"
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
  )
}
