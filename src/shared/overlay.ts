import type { SiteSecurity } from "./site-security"

export const OVERLAY_STATE_CHANNEL = "photon:overlay:state"
export const OVERLAY_HIDDEN_CHANNEL = "photon:overlay:hidden"
export const OVERLAY_HIDE_CHANNEL = "photon:overlay:hide"
export const OVERLAY_SHOW_SITE_SECURITY_CHANNEL = "photon:overlay:show-site-security"

export interface OverlayBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface SiteSecurityOverlayState {
  kind: "site-security"
  site: SiteSecurity
}

export interface PhotonOverlayAPI {
  showSiteSecurity: (bounds: OverlayBounds, site: SiteSecurity) => Promise<void>
  hide: () => Promise<void>
  onHidden: (listener: () => void) => () => void
}

export interface PhotonOverlayPreloadAPI {
  hide: () => Promise<void>
  onState: (listener: (state: SiteSecurityOverlayState) => void) => () => void
  onHidden: (listener: () => void) => () => void
}
