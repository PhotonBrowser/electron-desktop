import { ExternalLink, FolderOpen, Pause, Play, X } from "lucide-react"
import { memo } from "react"
import type { BrowserDownload } from "@/shared/photon-api"
import { IconButton } from "@/renderer/src/ui/IconButton"
import { formatBytes, getDownloadProgress } from "../downloads.utils"
import type { DownloadsActions } from "../downloads.types"
import { DownloadProgress } from "./DownloadProgress"

const statusLabels: Record<BrowserDownload["state"], string> = {
  starting: "Starting",
  progressing: "Downloading",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
}

export const DownloadItem = memo(function DownloadItem({
  download,
  actions,
}: {
  download: BrowserDownload
  actions: DownloadsActions
}): React.JSX.Element {
  const progress = getDownloadProgress(download)
  const isActive =
    download.state === "starting" || download.state === "progressing" || download.state === "paused"
  const isFinished = download.state === "completed"
  const size = `${formatBytes(download.receivedBytes)}${download.totalBytes === null ? "" : ` / ${formatBytes(download.totalBytes)}`}`

  return (
    <article
      className={`photon-download-item ${isFinished ? "is-openable" : ""}`.trim()}
      aria-label={`${download.filename}, ${statusLabels[download.state]}`}
      title={isFinished ? "Double-click to open" : undefined}
      onDoubleClick={(event) => {
        if (!isFinished || (event.target instanceof Element && event.target.closest("button")))
          return
        void actions.open(download.id)
      }}
    >
      <div className="photon-download-item-heading">
        <span className="photon-download-filename" title={download.filename}>
          {download.filename}
        </span>
        <span className="photon-download-status">{statusLabels[download.state]}</span>
      </div>
      {isActive ? <DownloadProgress download={download} /> : null}
      <div className="photon-download-item-meta">
        <span className="photon-download-size">
          {size}
          {progress === null && isActive
            ? " · Size unknown"
            : progress === null
              ? ""
              : ` · ${Math.round(progress * 100)}%`}
        </span>
        <div className="photon-download-actions">
          {isActive ? (
            <>
              {download.state === "paused" ? (
                <IconButton
                  ariaLabel={`Resume ${download.filename}`}
                  onPress={() => void actions.resume(download.id)}
                  size="sm"
                >
                  <Play size={14} />
                </IconButton>
              ) : (
                <IconButton
                  ariaLabel={`Pause ${download.filename}`}
                  onPress={() => void actions.pause(download.id)}
                  size="sm"
                >
                  <Pause size={14} />
                </IconButton>
              )}
              <IconButton
                ariaLabel={`Cancel ${download.filename}`}
                onPress={() => void actions.cancel(download.id)}
                size="sm"
              >
                <X size={14} />
              </IconButton>
            </>
          ) : isFinished ? (
            <>
              <IconButton
                ariaLabel={`Open ${download.filename}`}
                onPress={() => void actions.open(download.id)}
                size="sm"
              >
                <ExternalLink size={14} />
              </IconButton>
              <IconButton
                ariaLabel={`Show ${download.filename} in folder`}
                onPress={() => void actions.showInFolder(download.id)}
                size="sm"
              >
                <FolderOpen size={14} />
              </IconButton>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
})
