import { useEffect } from "react"
import type { ThemeMode } from "@/shared/browser-settings"

export function usePhotonTheme(themeMode: ThemeMode): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add("photon-theme-switching")

    if (themeMode === "system") root.removeAttribute("data-theme")
    else root.dataset.theme = themeMode

    void root.offsetWidth
    const frame = window.requestAnimationFrame(() => {
      root.classList.remove("photon-theme-switching")
    })

    return () => {
      window.cancelAnimationFrame(frame)
      root.classList.remove("photon-theme-switching")
    }
  }, [themeMode])
}
