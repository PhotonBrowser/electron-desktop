import type { PhotonAPI } from "./photon-api"

declare global {
  interface Window {
    photon: PhotonAPI
  }
}

export {}
