import { Button, PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from "@heroui/react"
import { Check, Download, FolderOpen, Pause, Play, X } from "lucide-react"
import { useState } from "react"
import type { BrowserDownload } from "@/preload/photon-api"
import { downloadProgress, formatBytes } from "./download-format"
import { useDownloadsStore } from "../stores/downloads-store"

export function DownloadsButton(): React.JSX.Element | null {
  const downloads = useDownloadsStore((state) => state.downloads)
  const [isOpen, setIsOpen] = useState(false)
  if (downloads.length === 0) return null
  const active = downloads.some(
    ({ state }) => state === "starting" || state === "progressing" || state === "paused",
  )

  return (
    <PopoverRoot isOpen={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger>
        <Button
          isIconOnly
          aria-label="Downloads"
          className="photon-toolbar-button photon-downloads-button"
          size="sm"
          variant="ghost"
        >
          <Download size={18} />
          {active && <span className="photon-downloads-indicator" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="photon-downloads-popover" placement="bottom end" offset={8}>
        <PopoverDialog>
          <DownloadsPopover />
        </PopoverDialog>
      </PopoverContent>
    </PopoverRoot>
  )
}

export function DownloadsPopover({
  downloads,
}: {
  downloads?: BrowserDownload[]
}): React.JSX.Element {
  const storedDownloads = useDownloadsStore((state) => state.downloads)
  const visibleDownloads = downloads ?? storedDownloads
  return (
    <section className="photon-downloads-content" aria-label="Downloads">
      <h2>Downloads</h2>
      <div className="photon-downloads-list">
        {visibleDownloads.map((download) => (
          <DownloadItemRow key={download.id} download={download} />
        ))}
      </div>
    </section>
  )
}

function DownloadItemRow({ download }: { download: BrowserDownload }): React.JSX.Element {
  const progress = downloadProgress(download.receivedBytes, download.totalBytes)
  const active =
    download.state === "starting" || download.state === "progressing" || download.state === "paused"
  const failed = download.state === "cancelled" || download.state === "interrupted"
  return (
    <article className="photon-download-row">
      <div className="photon-download-heading">
        <span title={download.filename}>{download.filename}</span>
        {download.state === "completed" && <Check size={14} aria-label="Completed" />}
      </div>
      {active && (
        <>
          <div
            className="photon-download-progress"
            aria-label={progress === null ? "Downloading" : `${Math.round(progress * 100)}%`}
          >
            <span style={progress === null ? undefined : { width: `${progress * 100}%` }} />
          </div>
          <div className="photon-download-meta">
            <span>{progress === null ? "Downloading" : `${Math.round(progress * 100)}%`}</span>
            <span>
              {formatBytes(download.receivedBytes)}
              {download.totalBytes === null ? "" : ` / ${formatBytes(download.totalBytes)}`}
            </span>
          </div>
        </>
      )}
      {!active && (
        <p className={failed ? "photon-download-failed" : undefined}>
          {stateLabel(download.state)}
        </p>
      )}
      <div className="photon-download-actions">
        {download.state === "progressing" && (
          <ActionButton
            label="Pause"
            icon={<Pause size={13} />}
            onPress={() => void window.photon.downloads.pause(download.id)}
          />
        )}
        {download.state === "paused" && (
          <ActionButton
            label="Resume"
            icon={<Play size={13} />}
            onPress={() => void window.photon.downloads.resume(download.id)}
          />
        )}
        {active && (
          <ActionButton
            label="Cancel"
            icon={<X size={13} />}
            onPress={() => void window.photon.downloads.cancel(download.id)}
          />
        )}
        {download.state === "completed" && (
          <ActionButton
            label="Open"
            icon={<FolderOpen size={13} />}
            onPress={() => void window.photon.downloads.open(download.id)}
          />
        )}
        {download.state === "completed" && (
          <ActionButton
            label="Show in folder"
            onPress={() => void window.photon.downloads.showInFolder(download.id)}
          />
        )}
      </div>
    </article>
  )
}

function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string
  icon?: React.ReactNode
  onPress: () => void
}): React.JSX.Element {
  return (
    <button className="photon-download-action" type="button" onClick={onPress}>
      {icon}
      {label}
    </button>
  )
}

function stateLabel(state: BrowserDownload["state"]): string {
  return state === "completed"
    ? "Completed"
    : state === "cancelled"
      ? "Cancelled"
      : "Download interrupted"
}
