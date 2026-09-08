import { Copy, Minus, Square, X } from "lucide-react"
import { useBrowserStore } from "../stores/browser-store"

export function WindowControls(): React.JSX.Element | null {
  const isMaximized = useBrowserStore((state) => state.isMaximized)
  if (navigator.platform.startsWith("Mac")) return null

  return (
    <div className="photon-window-controls">
      <button
        aria-label="Minimize"
        className="photon-window-control"
        type="button"
        onClick={() => void window.photon.window.minimize()}
      >
        <Minus size={15} />
      </button>
      <button
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className="photon-window-control"
        type="button"
        onClick={() => void window.photon.window.toggleMaximize()}
      >
        {isMaximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button
        aria-label="Close"
        className="photon-window-control photon-window-control-close"
        type="button"
        onClick={() => void window.photon.window.close()}
      >
        <X size={15} />
      </button>
    </div>
  )
}
