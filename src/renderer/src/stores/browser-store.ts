import { create } from "zustand"
import type { BrowserTab, PhotonSnapshot, TabId } from "@/preload/photon-api"

interface BrowserStore {
  tabs: BrowserTab[]
  activeTabId: TabId
  isMaximized: boolean
  themeMode: ThemeMode
  setThemeMode: (themeMode: ThemeMode) => void
  applySnapshot: (snapshot: PhotonSnapshot) => void
}

export type ThemeMode = "system" | "light" | "dark"

function getInitialThemeMode(): ThemeMode {
  const saved = window.localStorage.getItem("photon-theme-mode")
  return saved === "light" || saved === "dark" ? saved : "system"
}

export const useBrowserStore = create<BrowserStore>((set) => ({
  tabs: [],
  activeTabId: "tab-1" as TabId,
  isMaximized: false,
  themeMode: getInitialThemeMode(),
  setThemeMode: (themeMode) => {
    window.localStorage.setItem("photon-theme-mode", themeMode)
    set({ themeMode })
  },
  applySnapshot: (snapshot) => set(snapshot),
}))
