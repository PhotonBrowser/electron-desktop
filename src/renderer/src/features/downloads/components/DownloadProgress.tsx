import type { BrowserDownload } from "@/shared/photon-api"
import { getDownloadProgress } from "../downloads.utils"

export function DownloadProgress({ download }: { download: BrowserDownload }): React.JSX.Element {
  const progress = getDownloadProgress(download)
  const percentage = progress === null ? null : Math.round(progress * 100)
  return (
    <div
      aria-label={percentage === null ? "Download progress unknown" : `${percentage}% downloaded`}
      aria-valuemax={percentage === null ? undefined : 100}
      aria-valuemin={percentage === null ? undefined : 0}
      aria-valuenow={percentage === null ? undefined : percentage}
      className={`photon-download-progress ${percentage === null ? "is-indeterminate" : ""}`.trim()}
      role="progressbar"
    >
      {percentage === null ? null : <span style={{ width: `${percentage}%` }} />}
    </div>
  )
}
