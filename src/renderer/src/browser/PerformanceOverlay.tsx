import { useEffect, useState } from "react"
import type { PhotonPerformanceMetrics } from "@/preload/photon-api"

const METRICS_INTERVAL_MS = 2_000

function formatMB(bytes: number | null): string {
  if (bytes === null) return "n/a"
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

/** Development diagnostics rendered by the persistent chrome renderer. */
export function PerformanceOverlay(): React.JSX.Element {
  const [metrics, setMetrics] = useState<PhotonPerformanceMetrics | undefined>()
  const enabled = import.meta.env.DEV && new URLSearchParams(window.location.search).has("perf")

  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let sampleInFlight = false
    const sample = async (): Promise<void> => {
      if (disposed || sampleInFlight) return
      sampleInFlight = true
      try {
        const nextMetrics = await window.photon.performance.getMetrics()
        if (!disposed) setMetrics(nextMetrics)
      } catch {
        // Diagnostics are best-effort and must not affect browser behavior.
      } finally {
        sampleInFlight = false
      }
    }

    void sample()
    const interval = setInterval(() => void sample(), METRICS_INTERVAL_MS)
    return () => {
      disposed = true
      clearInterval(interval)
    }
  }, [enabled])

  if (!enabled) return <></>

  return (
    <div className="perf-overlay z-50">
      <div>
        CPU{" "}
        <span className="perf-value">{metrics ? `${metrics.cpuPercent.toFixed(1)}%` : "…"}</span>
      </div>
      <div>
        RAM <span className="perf-value">{formatMB(metrics?.totalWorkingSetBytes ?? null)}</span>
      </div>
      <div>
        Heap <span className="perf-value">{formatMB(metrics?.ramHeapUsedBytes ?? null)}</span>
      </div>
      <div>
        Renderers <span className="perf-value">{metrics?.rendererCount ?? "…"}</span>
      </div>
      <div>
        WebContents <span className="perf-value">{metrics?.webContentsCount ?? "…"}</span>
      </div>
      <div>
        Active page <span className="perf-value">{getActivePageLabel(metrics)}</span>
      </div>
      {metrics?.tabs.map((tab) => (
        <div key={tab.tabId}>
          {tab.tabId}{" "}
          <span className="perf-value">{tab.webviewAttached ? "webview" : "chrome-only"}</span>
        </div>
      ))}
      <div className="perf-note">Event-driven UI · no layout polling</div>
    </div>
  )
}

function getActivePageLabel(metrics: PhotonPerformanceMetrics | undefined): string {
  if (!metrics) return "…"
  const activeTab = metrics.tabs.find((tab) => tab.tabId === metrics.activeTabId)
  return activeTab?.webviewAttached ? "webview" : "none"
}
