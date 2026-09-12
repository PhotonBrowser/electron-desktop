import { Input } from "@heroui/react"
import { useState, type FormEvent, type KeyboardEvent, type RefObject } from "react"
import { useActiveTab, useActiveTabId } from "../../browser/hooks/useActiveTab"
import { SiteSecurity } from "./SiteSecurity"

interface OmniboxProps {
  addressInput: RefObject<HTMLInputElement | null>
}

export function Omnibox({ addressInput }: OmniboxProps): React.JSX.Element {
  const activeTab = useActiveTab()
  const activeTabId = useActiveTabId()
  const [draftAddress, setDraftAddress] = useState("")
  const [editingTabId, setEditingTabId] = useState<typeof activeTabId | null>(null)

  const submitAddress = (): void => {
    setEditingTabId(null)
    addressInput.current?.blur()
    void window.photon.navigation.navigate(draftAddress)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    submitAddress()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Escape") return
    setEditingTabId(null)
    addressInput.current?.blur()
  }

  const isEditingActiveTab = editingTabId === activeTabId

  return (
    <form className="photon-omnibox-form" onSubmit={handleSubmit}>
      <div className="photon-omnibox-wrap">
        <SiteSecurity />
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
          onKeyDown={handleKeyDown}
        />
      </div>
    </form>
  )
}
