import { Download } from "lucide-react"
import { Popover } from "@heroui/react"
import { useCallback, useRef, useState } from "react"
import type { BrowserDownload } from "@/shared/photon-api"
import { IconButton } from "@/renderer/src/ui/IconButton"
import type { DownloadsActions } from "../downloads.types"
import { getDownloadProgress, isActiveDownload } from "../downloads.utils"
import { DownloadsPopover } from "./DownloadsPopover"

interface DownloadsButtonProps {
  downloads: BrowserDownload[]
  activeCount: number
  actions: DownloadsActions
  clearCompleted: () => void
}

export function DownloadsButton({
  downloads,
  activeCount,
  actions,
  clearCompleted,
}: DownloadsButtonProps): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback((): void => {
    setIsOpen(false)
    buttonRef.current?.focus()
  }, [])

  const completedCount = downloads.filter(
    (download) =>
      download.state === "completed" ||
      download.state === "cancelled" ||
      download.state === "interrupted",
  ).length
  const indicator = activeCount > 0 ? "active" : completedCount > 0 ? "finished" : "idle"
  const activeDownload = downloads.find(isActiveDownload)
  const progress = activeDownload ? getDownloadProgress(activeDownload) : null
  if (downloads.length === 0) return null

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      {isOpen ? (
        <div aria-hidden="true" className="photon-downloads-dismiss-layer" onMouseDown={close} />
      ) : null}
      <Popover.Trigger className="photon-downloads-anchor" data-indicator={indicator}>
        <IconButton
          ref={buttonRef}
          ariaLabel={activeCount > 0 ? `${activeCount} active downloads` : "Downloads"}
          className="photon-toolbar-button photon-downloads-trigger"
          size="sm"
          type="button"
        >
          {activeDownload ? (
            <svg
              aria-hidden="true"
              className={`photon-download-progress-ring ${progress === null ? "is-indeterminate" : ""}`.trim()}
              viewBox="0 0 28 28"
            >
              <circle className="photon-download-progress-ring-track" cx="14" cy="14" r="12" />
              <circle
                className="photon-download-progress-ring-value"
                cx="14"
                cy="14"
                r="12"
                strokeDasharray="75.4"
                strokeDashoffset={progress === null ? undefined : 75.4 * (1 - progress)}
              />
            </svg>
          ) : null}
          <span aria-hidden="true" className="photon-downloads-icon-wrap">
            <Download size={18} />
          </span>
        </IconButton>
      </Popover.Trigger>
      <Popover.Content
        className="photon-popover-surface photon-downloads-popover"
        placement="bottom end"
      >
        <Popover.Dialog aria-label="Downloads">
          <DownloadsPopover
            actions={actions}
            completedCount={completedCount}
            downloads={downloads}
            onClearCompleted={clearCompleted}
            onClose={close}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
