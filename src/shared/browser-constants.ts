import type { MemorySaverLevel, MemorySaverSettings } from "./photon-api"

export const BROWSER_DEFAULTS = {
  loadingTitle: "Loading…",
  newTabTitle: "New Tab",
  searchEngineUrl: "https://www.google.com/search",
} as const

export const MEMORY_SAVER_DELAYS_MS: Record<MemorySaverLevel, number> = {
  moderate: 5 * 60 * 1000,
  balanced: 60 * 1000,
  maximum: 15 * 1000,
}

export const DEFAULT_MEMORY_SAVER_SETTINGS: MemorySaverSettings = {
  enabled: true,
  level: "balanced",
}

export const BROWSER_STORAGE_KEYS = {
  preferences: "photon-browser-preferences",
  legacyThemeMode: "photon-theme-mode",
  legacyMemorySaverEnabled: "photon-memory-saver-enabled",
  legacyMemorySaverLevel: "photon-memory-saver-level",
} as const

export const PERFORMANCE_METRICS_INTERVAL_MS = 2_000
