import { create } from "zustand"
import { persist } from "zustand/middleware"
import { BROWSER_STORAGE_KEYS } from "@/shared/browser-constants"
import { isMemorySaverLevel, isThemeMode, type ThemeMode } from "@/shared/browser-settings"
import type {
  MemorySaverLevel,
  PhotonBrowserUpdateEnvelope,
  PhotonSnapshot,
} from "@/shared/photon-api"
import {
  applyBrowserSnapshot,
  applyBrowserUpdates,
  type BrowserStateSnapshot,
} from "./browser-store-state"

interface BrowserPreferences {
  themeMode: ThemeMode
  memorySaverEnabled: boolean
  memorySaverLevel: MemorySaverLevel
}

interface BrowserStore extends BrowserStateSnapshot, BrowserPreferences {
  setThemeMode: (themeMode: ThemeMode) => void
  setMemorySaverEnabled: (enabled: boolean) => void
  setMemorySaverLevel: (level: MemorySaverLevel) => void
  applySnapshot: (snapshot: PhotonSnapshot) => void
  applyUpdates: (updates: PhotonBrowserUpdateEnvelope[]) => void
}

const DEFAULT_BROWSER_PREFERENCES = getInitialBrowserPreferences()

export const useBrowserStore = create<BrowserStore>()(
  persist(
    (set) => ({
      revision: 0,
      tabs: [],
      activeTabId: "tab-1" as BrowserStateSnapshot["activeTabId"],
      isMaximized: false,
      ...DEFAULT_BROWSER_PREFERENCES,
      setThemeMode: (themeMode) => set({ themeMode }),
      setMemorySaverEnabled: (memorySaverEnabled) => set({ memorySaverEnabled }),
      setMemorySaverLevel: (memorySaverLevel) => set({ memorySaverLevel }),
      applySnapshot: (snapshot) => set((state) => applyBrowserSnapshot(state, snapshot)),
      applyUpdates: (updates) => set((state) => applyBrowserUpdates(state, updates)),
    }),
    {
      name: BROWSER_STORAGE_KEYS.preferences,
      partialize: (state): BrowserPreferences => ({
        themeMode: state.themeMode,
        memorySaverEnabled: state.memorySaverEnabled,
        memorySaverLevel: state.memorySaverLevel,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...parseBrowserPreferences(persistedState),
      }),
    },
  ),
)

function parseBrowserPreferences(value: unknown): Partial<BrowserPreferences> {
  const preferences = asRecord(value)
  if (!preferences) return {}
  return {
    ...(isThemeMode(preferences.themeMode) ? { themeMode: preferences.themeMode } : {}),
    ...(typeof preferences.memorySaverEnabled === "boolean"
      ? { memorySaverEnabled: preferences.memorySaverEnabled }
      : {}),
    ...(isMemorySaverLevel(preferences.memorySaverLevel)
      ? { memorySaverLevel: preferences.memorySaverLevel }
      : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : null
}

function getInitialBrowserPreferences(): BrowserPreferences {
  const themeMode = window.localStorage.getItem(BROWSER_STORAGE_KEYS.legacyThemeMode)
  const memorySaverLevel = window.localStorage.getItem(BROWSER_STORAGE_KEYS.legacyMemorySaverLevel)
  return {
    themeMode: isThemeMode(themeMode) ? themeMode : "system",
    memorySaverEnabled:
      window.localStorage.getItem(BROWSER_STORAGE_KEYS.legacyMemorySaverEnabled) !== "false",
    memorySaverLevel: isMemorySaverLevel(memorySaverLevel) ? memorySaverLevel : "balanced",
  }
}
