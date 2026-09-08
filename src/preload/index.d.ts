import type { PhotonAPI } from "./photon-api"
import type { PhotonOverlayPreloadAPI } from "@/shared/overlay"

declare global {
  interface Window {
    photon: PhotonAPI
    photonOverlay: PhotonOverlayPreloadAPI
  }
}

export {}
