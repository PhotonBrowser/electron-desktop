import { useEffect, useState } from "react"
import type { PhotonPerformanceMetrics } from "@/preload/photon-api"

const METRICS_INTERVAL_MS = 2_000

function formatMB(bytes: number | null): string {
  if (bytes === null) return "n/a"
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export function PerformanceOverlay(): React.JSX.Element {
  const [metrics, setMetrics] = useState<PhotonPerformanceMetrics | undefined>()
  const [siteSecurityVisible, setSiteSecurityVisible] = useState(false)
  const enabled =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("perf") &&
    !siteSecurityVisible

  useEffect(() => {
    const unsubscribeState = window.photonOverlay.onState(() => setSiteSecurityVisible(true))
    const unsubscribeHidden = window.photonOverlay.onHidden(() => setSiteSecurityVisible(false))
    return () => {
      unsubscribeState()
      unsubscribeHidden()
    }
  }, [])

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
    <div className="perf-overlay">
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
          <span className="perf-value">{tab.pageRendererInitialized ? "page" : "chrome-only"}</span>
        </div>
      ))}
      {metrics?.processes.map((process) => (
        <div key={`${process.type}-${process.pid}`}>
          {process.type} {process.pid}{" "}
          <span className="perf-value">{formatMB(process.workingSetBytes)}</span>
        </div>
      ))}
      {metrics?.processes.flatMap((process) =>
        process.webContents.map((webContents) => (
          <div key={`webcontents-${webContents.id}`}>
            wc#{webContents.id} <span className="perf-value">{webContents.url || "<empty>"}</span>
          </div>
        )),
      )}
      <div className="perf-note">FPS sampling off · event-driven UI</div>
    </div>
  )
}

function getActivePageLabel(metrics: PhotonPerformanceMetrics | undefined): string {
  if (!metrics) return "…"
  const activeTab = metrics.tabs.find((tab) => tab.tabId === metrics.activeTabId)
  if (!activeTab?.pageRendererInitialized) return "none"
  return activeTab.pageWebContentsId === null ? "destroyed" : String(activeTab.pageWebContentsId)
}
