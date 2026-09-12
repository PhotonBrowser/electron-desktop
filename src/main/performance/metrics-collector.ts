import { app, webContents } from "electron"
import { logger } from "../../shared/logger"
import type {
  PhotonPerformanceMetrics,
  PhotonProcessMetric,
  PhotonWebContentsMetric,
} from "@/shared/photon-api"
import type { TabManager } from "../browser/tab-manager"

/**
 * Collects on-demand development diagnostics. Memory values are process
 * working sets, so shared Chromium pages are counted once per OS process.
 */
export function collectMetrics(
  tabManager: Pick<TabManager, "getDiagnostics">,
): PhotonPerformanceMetrics {
  const processMetrics = app.getAppMetrics()
  const webContentsByPid = getWebContentsByPid()
  const processes = processMetrics.map((metric) =>
    toProcessMetric(metric, webContentsByPid.get(metric.pid) ?? []),
  )
  const totalWorkingSetBytes = processes.reduce(
    (total, metric) => total + metric.workingSetBytes,
    0,
  )
  const privateBytes = processes.map((metric) => metric.privateBytes).filter(isNumber)
  const browserProcess = processMetrics.find((metric) => metric.type === "Browser")
  const diagnostics = tabManager.getDiagnostics()

  const result = {
    cpuPercent: round(browserProcess?.cpu.percentCPUUsage ?? 0),
    ramTotalBytes: totalWorkingSetBytes,
    ramHeapUsedBytes: process.memoryUsage().heapUsed,
    rendererCount: processMetrics.filter((metric) => metric.type === "Tab").length,
    webContentsCount: webContents.getAllWebContents().length,
    totalWorkingSetBytes,
    totalPrivateBytes:
      privateBytes.length === 0 ? null : privateBytes.reduce((total, value) => total + value, 0),
    processes,
    activeTabId: diagnostics.activeTabId,
    tabs: diagnostics.tabs,
    timestamp: Date.now(),
  }

  if (process.env["PHOTON_PRINT_PROCESS_METRICS"] === "1") printProcessMetrics(result)
  return result
}

function getWebContentsByPid(): Map<number, PhotonWebContentsMetric[]> {
  const result = new Map<number, PhotonWebContentsMetric[]>()
  for (const contents of webContents.getAllWebContents()) {
    try {
      const metric: PhotonWebContentsMetric = {
        id: contents.id,
        type: contents.getType(),
        url: contents.getURL(),
        title: contents.getTitle(),
      }
      const processContents = result.get(contents.getOSProcessId()) ?? []
      processContents.push(metric)
      result.set(contents.getOSProcessId(), processContents)
    } catch {
      continue
    }
  }
  return result
}

function toProcessMetric(
  metric: Electron.ProcessMetric,
  contents: PhotonWebContentsMetric[],
): PhotonProcessMetric {
  return {
    type: metric.type,
    name: metric.name ?? null,
    pid: metric.pid,
    cpuPercent: round(metric.cpu.percentCPUUsage),
    workingSetBytes: metric.memory.workingSetSize * 1024,
    privateBytes:
      metric.memory.privateBytes === undefined ? null : metric.memory.privateBytes * 1024,
    webContents: contents,
  }
}

function printProcessMetrics(metrics: PhotonPerformanceMetrics): void {
  logger.debug("process metrics")
  for (const process of metrics.processes) {
    const contents = process.webContents
      .map((webContent) => `wc#${webContent.id} ${webContent.type} ${webContent.url || "<empty>"}`)
      .join(" | ")
    logger.debug(
      `${process.pid}\t${process.type}\t${formatMB(process.workingSetBytes)}\t${contents || "-"}`,
    )
  }
}

function isNumber(value: number | null): value is number {
  return value !== null
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
