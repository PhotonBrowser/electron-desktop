import { Asterisk, ChevronRight, LockKeyhole, ShieldAlert, X } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { getSiteSecurity, type SiteSecurity as SiteSecurityState } from "@/shared/site-security"
import { IconButton } from "@/renderer/src/ui/IconButton"
import { useClickOutside } from "@/renderer/hooks/useClickOutside"
import { useActiveTab } from "../../browser/hooks/useActiveTab"

interface PopoverPosition {
  left: number
  top: number
}

export function SiteSecurity(): React.JSX.Element {
  const activeTab = useActiveTab()
  const siteSecurity = activeTab?.showInUrlBar === true ? getSiteSecurity(activeTab.url) : null
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<PopoverPosition>({ left: 8, top: 74 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!isOpen) return
    const updatePosition = (): void => {
      const nextPosition = getPopoverPosition(buttonRef.current)
      if (nextPosition) setPosition(nextPosition)
    }
    updatePosition()
    window.addEventListener("resize", updatePosition)
    return () => window.removeEventListener("resize", updatePosition)
  }, [isOpen])

  useClickOutside(popoverRef, () => setIsOpen(false), isOpen)

  const toggle = (): void => {
    if (!siteSecurity) return
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const nextPosition = getPopoverPosition(buttonRef.current)
    if (!nextPosition) return
    setPosition(nextPosition)
    setIsOpen(true)
  }

  return (
    <>
      <IconButton
        ref={buttonRef}
        ariaLabel="Site information"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="photon-address-icon-button z-10"
        isDisabled={!siteSecurity}
        size="sm"
        type="button"
        variant="ghost"
        onPress={toggle}
      >
        <Asterisk aria-hidden="true" size={20} strokeWidth={2.5} />
      </IconButton>
      {isOpen && siteSecurity ? (
        <SiteSecurityPopover
          popoverRef={popoverRef}
          position={position}
          siteSecurity={siteSecurity}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  )
}

interface SiteSecurityPopoverProps {
  popoverRef: React.RefObject<HTMLElement | null>
  position: PopoverPosition
  siteSecurity: SiteSecurityState
  onClose: () => void
}

function SiteSecurityPopover({
  popoverRef,
  position,
  siteSecurity,
  onClose,
}: SiteSecurityPopoverProps): React.JSX.Element {
  return (
    <div className="browser-overlay-layer">
      <section
        ref={popoverRef}
        aria-label={`Site information for ${siteSecurity.host}`}
        className="photon-site-security-popover z-50"
        role="dialog"
        style={{ left: position.left, top: position.top }}
      >
        <div className="photon-site-security-header">
          <strong>{siteSecurity.host}</strong>
          <button
            aria-label="Close site information"
            className="photon-site-security-close"
            type="button"
            onClick={onClose}
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
          <span>{siteSecurity.isSecure ? "Connection is secure" : "Connection is not secure"}</span>
          <ChevronRight aria-hidden="true" className="photon-site-security-chevron" size={18} />
        </div>
      </section>
    </div>
  )
}

function getPopoverPosition(button: HTMLButtonElement | null): PopoverPosition | null {
  const bounds = button?.getBoundingClientRect()
  if (!bounds) return null
  return {
    left: Math.max(8, Math.round(bounds.left - 8)),
    top: Math.round(bounds.bottom + 6),
  }
}
