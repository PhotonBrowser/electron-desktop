import { ArrowDown, ArrowUp, X } from "lucide-react"
import { IconButton } from "@/renderer/src/ui/IconButton"
import type { FindController } from "../find.types"
import { useFindInPage } from "../hooks/useFindInPage"

interface FindBarProps {
  controller: FindController | null
  loading: boolean
}

export function FindBar({ controller, loading }: FindBarProps): React.JSX.Element | null {
  const { state, isOpen, inputRef, close, setQuery, next, previous, handleKeyDown } = useFindInPage(
    { controller, loading },
  )
  if (!isOpen) return null

  const hasMatches = state.matches > 0
  return (
    <div className="photon-popover-surface photon-find-bar" role="search" aria-label="Find in page">
      <input
        ref={inputRef}
        aria-label="Find in page"
        className="photon-find-input"
        placeholder="Search this page..."
        value={state.query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <span className="photon-find-count" aria-live="polite">
        {state.activeMatch} / {state.matches}
      </span>
      <IconButton
        ariaLabel="Previous match"
        className="photon-find-button"
        isDisabled={!hasMatches}
        onPress={previous}
      >
        <ArrowUp aria-hidden="true" size={16} />
      </IconButton>
      <IconButton
        ariaLabel="Next match"
        className="photon-find-button"
        isDisabled={!hasMatches}
        onPress={next}
      >
        <ArrowDown aria-hidden="true" size={16} />
      </IconButton>
      <IconButton ariaLabel="Close find bar" className="photon-find-button" onPress={close}>
        <X aria-hidden="true" size={16} />
      </IconButton>
    </div>
  )
}
