import { Button, Input } from "@heroui/react"
import { Asterisk, ArrowLeft, ArrowRight, RotateCw } from "lucide-react"
import { useState, type FormEvent, type KeyboardEvent, type RefObject } from "react"
import { useBrowserStore } from "../stores/browser-store"
import { DownloadsButton } from "./DownloadsButton"

interface ToolbarProps {
  addressInput: RefObject<HTMLInputElement | null>
}

export function Toolbar({ addressInput }: ToolbarProps): React.JSX.Element {
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const [draftAddress, setDraftAddress] = useState("")
  const [editing, setEditing] = useState(false)

  const submitAddress = (): void => {
    setEditing(false)
    addressInput.current?.blur()
    void window.photon.navigation.navigate(draftAddress)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submitAddress()
  }

  const handleAddressKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setEditing(false)
      addressInput.current?.blur()
    }
  }

  return (
    <header className="photon-toolbar">
      <div className="photon-navigation-controls">
        <Button
          isIconOnly
          aria-label="Back"
          className="photon-toolbar-button"
          isDisabled={!activeTab?.canGoBack}
          size="sm"
          variant="ghost"
          onPress={() => void window.photon.navigation.back()}
        >
          <ArrowLeft size={19} />
        </Button>
        <Button
          isIconOnly
          aria-label="Forward"
          className="photon-toolbar-button"
          isDisabled={!activeTab?.canGoForward}
          size="sm"
          variant="ghost"
          onPress={() => void window.photon.navigation.forward()}
        >
          <ArrowRight size={19} />
        </Button>
        <Button
          isIconOnly
          aria-label="Reload"
          className="photon-toolbar-button"
          size="sm"
          variant="ghost"
          onPress={() => void window.photon.navigation.reload()}
        >
          <RotateCw size={19} />
        </Button>
      </div>
      <form className="photon-omnibox-form" onSubmit={handleSubmit}>
        <div className="photon-omnibox-wrap">
          <Asterisk
            aria-hidden="true"
            className="photon-address-icon pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2"
            size={21}
            strokeWidth={2.5}
          />
          <Input
            ref={addressInput}
            aria-label="Address"
            className="photon-address-input"
            value={
              editing
                ? draftAddress
                : activeTab?.showInUrlBar === false
                  ? ""
                  : (activeTab?.url ?? "")
            }
            placeholder="Search Google or enter a URL"
            variant="secondary"
            onBlur={() => setEditing(false)}
            onChange={(event) => setDraftAddress(event.target.value)}
            onFocus={(event) => {
              setDraftAddress(activeTab?.showInUrlBar === false ? "" : (activeTab?.url ?? ""))
              setEditing(true)
              event.currentTarget.select()
            }}
            onKeyDown={handleAddressKeyDown}
          />
        </div>
      </form>
      <DownloadsButton />
    </header>
  )
}
