import type { TabId } from "@/shared/photon-api"

export interface FindResult {
  requestId: number
  activeMatchOrdinal: number
  matches: number
}

export interface FindController {
  readonly tabId: TabId
  find: (query: string, forward: boolean) => number | null
  stop: () => void
  focus: () => void
  subscribe: (listener: (result: FindResult) => void) => () => void
}
