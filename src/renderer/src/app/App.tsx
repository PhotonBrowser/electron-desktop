import { useEffect, useRef } from "react"
import type { PhotonBrowserUpdateEnvelope } from "@/preload/photon-api"
import { Titlebar } from "../browser/Titlebar"
import { Toolbar } from "../browser/Toolbar"
import { NewTabPage } from "../browser/NewTabPage"
import { SettingsPage } from "../browser/SettingsPage"
import { useBrowserStore } from "../stores/browser-store"

function App(): React.JSX.Element {
  return <BrowserApp />
}

function BrowserApp(): React.JSX.Element {
  const addressInput = useRef<HTMLInputElement>(null)
  const applySnapshot = useBrowserStore((state) => state.applySnapshot)
  const applyUpdates = useBrowserStore((state) => state.applyUpdates)
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const themeMode = useBrowserStore((state) => state.themeMode)
  const memorySaverEnabled = useBrowserStore((state) => state.memorySaverEnabled)
  const memorySaverLevel = useBrowserStore((state) => state.memorySaverLevel)

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

  useEffect(() => {
    void window.photon.memorySaver
      .setSettings({ enabled: memorySaverEnabled, level: memorySaverLevel })
      .catch(console.error)
  }, [memorySaverEnabled, memorySaverLevel])

  useEffect(() => {
    const pendingUpdates: PhotonBrowserUpdateEnvelope[] = []
    let updateFrame: number | undefined
    const flushUpdates = (): void => {
      updateFrame = undefined
      if (pendingUpdates.length === 0) return
      applyUpdates(pendingUpdates.splice(0))
    }
    const handleUpdates = (updates: PhotonBrowserUpdateEnvelope[]): void => {
      pendingUpdates.push(...updates)
      if (updateFrame === undefined) updateFrame = window.requestAnimationFrame(flushUpdates)
    }
    const unsubscribeUpdates = window.photon.onUpdates(handleUpdates)
    const unsubscribeFocus = window.photon.onFocusOmnibox(() => {
      const input = addressInput.current
      input?.focus()
      window.requestAnimationFrame(() => {
        const currentInput = addressInput.current
        if (currentInput?.value) currentInput.select()
      })
    })

    void window.photon.getSnapshot().then(applySnapshot).catch(console.error)

    return () => {
      unsubscribeUpdates()
      unsubscribeFocus()
      if (updateFrame !== undefined) window.cancelAnimationFrame(updateFrame)
    }
  }, [applySnapshot, applyUpdates])

  useEffect(() => {
    document.title = activeTab?.title || "Photon Browser"
  }, [activeTab?.title])

  return (
    <div className="h-full">
      <section className="photon-chrome">
        <Titlebar />
        <Toolbar addressInput={addressInput} />
      </section>
      {activeTab?.internalPage === "new-tab" && <NewTabPage />}
      {activeTab?.internalPage === "settings" && <SettingsPage />}
    </div>
  )
}

export default App
