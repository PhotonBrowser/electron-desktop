import "./index.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./app/App"

const root = document.getElementById("root")

if (!root) throw new Error("Photon renderer root missing")

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
