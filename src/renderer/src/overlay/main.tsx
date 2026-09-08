import "./index.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { OverlayApp } from "./OverlayApp"
import { PerformanceOverlay } from "./PerformanceOverlay"

const root = document.getElementById("root")

if (!root) throw new Error("Photon overlay renderer root missing")

createRoot(root).render(
  <StrictMode>
    <div className="photon-overlay-root">
      <OverlayApp />
      <PerformanceOverlay />
    </div>
  </StrictMode>,
)
