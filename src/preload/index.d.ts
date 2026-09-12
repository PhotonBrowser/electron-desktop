import type { PhotonAPI } from "@/shared/photon-api"

declare global {
  interface Window {
    photon: PhotonAPI
  }
}

export {}
