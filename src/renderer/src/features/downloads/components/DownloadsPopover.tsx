import { Trash2, X } from "lucide-react"
import type { BrowserDownload } from "@/shared/photon-api"
import { IconButton } from "@/renderer/src/ui/IconButton"
import type { DownloadsActions } from "../downloads.types"
import { DownloadItem } from "./DownloadItem"

interface DownloadsPopoverProps {
  downloads: BrowserDownload[]
  actions: DownloadsActions
  completedCount: number
  onClearCompleted: () => void
  onClose: () => void
}

export function DownloadsPopover({
  downloads,
  actions,
  completedCount,
  onClearCompleted,
  onClose,
}: DownloadsPopoverProps): React.JSX.Element {
  return (
    <div className="photon-downloads-content">
      <header className="photon-downloads-header">
        <h2>Downloads</h2>
        <div className="photon-downloads-header-actions">
          <button
            className="photon-downloads-clear"
            disabled={completedCount === 0}
            type="button"
            onClick={onClearCompleted}
          >
            <Trash2 aria-hidden="true" size={14} />
            Clear finished
          </button>
          <IconButton ariaLabel="Close downloads" onPress={onClose} size="sm">
            <X size={16} />
          </IconButton>
        </div>
      </header>
      {downloads.length === 0 ? (
        <p className="photon-downloads-empty">No downloads yet</p>
      ) : (
        <div className="photon-downloads-list">
          {downloads.map((download) => (
            <DownloadItem key={download.id} actions={actions} download={download} />
          ))}
        </div>
      )}
    </div>
  )
}
