import {
  DEFAULT_MEMORY_SAVER_SETTINGS,
  MEMORY_SAVER_DELAYS_MS,
} from "../../shared/browser-constants.ts"
import type { BrowserTab, MemorySaverSettings } from "@/shared/photon-api"

export interface TabRecord {
  state: BrowserTab
  inactiveTimer?: ReturnType<typeof setTimeout>
}

type UpdateTab = (record: TabRecord, nextState: BrowserTab) => void
type IsPageActive = (record: TabRecord) => boolean

/** Owns memory-saver timers without owning tab identity or browser handles. */
export class TabLifecycle {
  private settings: MemorySaverSettings = DEFAULT_MEMORY_SAVER_SETTINGS
  private readonly updateTab: UpdateTab
  private readonly isPageActive: IsPageActive

  constructor(updateTab: UpdateTab, isPageActive: IsPageActive) {
    this.updateTab = updateTab
    this.isPageActive = isPageActive
  }

  setSettings(settings: MemorySaverSettings, records: Iterable<TabRecord>): void {
    this.settings = settings
    for (const record of records) {
      if (record.state.kind !== "web") continue
      if (this.isPageActive(record)) {
        this.clearTimer(record)
        continue
      }
      if (!settings.enabled) {
        this.activate(record)
        continue
      }
      if (record.state.lifecycleState !== "frozen") this.schedule(record)
    }
  }

  activate(record: TabRecord): void {
    this.clearTimer(record)
    if (record.state.lifecycleState === "frozen") {
      this.updateTab(record, { ...record.state, lifecycleState: "active" })
    }
  }

  schedule(record: TabRecord): void {
    this.clearTimer(record)
    if (!this.settings.enabled || record.state.lifecycleState === "frozen") return

    record.inactiveTimer = setTimeout(() => {
      delete record.inactiveTimer
      if (!this.isPageActive(record)) {
        this.updateTab(record, { ...record.state, lifecycleState: "frozen" })
      }
    }, MEMORY_SAVER_DELAYS_MS[this.settings.level])
  }

  clear(record: TabRecord): void {
    this.clearTimer(record)
  }

  private clearTimer(record: TabRecord): void {
    if (record.inactiveTimer === undefined) return
    clearTimeout(record.inactiveTimer)
    delete record.inactiveTimer
  }
}
