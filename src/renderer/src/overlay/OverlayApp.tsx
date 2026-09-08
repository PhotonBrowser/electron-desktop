import { ChevronRight, LockKeyhole, ShieldAlert, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { SiteSecurityOverlayState } from "@/shared/overlay"

export function OverlayApp(): React.JSX.Element {
  const [state, setState] = useState<SiteSecurityOverlayState | null>(null)

  useEffect(() => {
    const unsubscribe = window.photonOverlay.onState(setState)
    const unsubscribeHidden = window.photonOverlay.onHidden(() => setState(null))
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault()
        void window.photonOverlay.hide()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      unsubscribe()
      unsubscribeHidden()
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  if (!state || state.kind !== "site-security") return <></>

  const { site } = state
  const ConnectionIcon = site.isSecure ? LockKeyhole : ShieldAlert

  return (
    <section
      aria-label={`Site information for ${site.host}`}
      className="photon-site-security-popover"
      role="dialog"
    >
      <div className="photon-site-security-header">
        <strong>{site.host}</strong>
        <button
          aria-label="Close site information"
          className="photon-site-security-close"
          type="button"
          onClick={() => void window.photonOverlay.hide()}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="photon-site-security-row">
        <ConnectionIcon aria-hidden="true" size={19} strokeWidth={1.8} />
        <span>{site.isSecure ? "Connection is secure" : "Connection is not secure"}</span>
        <ChevronRight aria-hidden="true" className="photon-site-security-chevron" size={18} />
      </div>
    </section>
  )
}
