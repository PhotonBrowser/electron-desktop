import { Copy, Minus, Square, X } from "lucide-react"
import { IconButton } from "../ui/IconButton"
import { useBrowserStore } from "../stores/browser-store"

export function WindowControls(): React.JSX.Element | null {
  const isMaximized = useBrowserStore((state) => state.isMaximized)
  if (navigator.platform.startsWith("Mac")) return null

  return (
    <div className="photon-window-controls">
      <IconButton
        ariaLabel="Minimize"
        className="photon-window-control"
        size="sm"
        variant="ghost"
        onPress={() => void window.photon.window.minimize()}
      >
        <Minus aria-hidden="true" size={11} />
      </IconButton>
      <IconButton
        ariaLabel={isMaximized ? "Restore window" : "Maximize window"}
        className="photon-window-control"
        size="sm"
        variant="ghost"
        onPress={() => void window.photon.window.toggleMaximize()}
      >
        {isMaximized ? (
          <Copy aria-hidden="true" size={10} />
        ) : (
          <Square aria-hidden="true" size={10} />
        )}
      </IconButton>
      <IconButton
        ariaLabel="Close window"
        className="photon-window-control photon-window-control-close"
        size="sm"
        variant="ghost"
        onPress={() => void window.photon.window.close()}
      >
        <X aria-hidden="true" size={11} />
      </IconButton>
    </div>
  )
}
