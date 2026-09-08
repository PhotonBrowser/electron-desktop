import { useEffect, useRef } from "react"
import type { PhotonSnapshot } from "@/preload/photon-api"
import { Titlebar } from "../browser/Titlebar"
import { Toolbar } from "../browser/Toolbar"
import { NewTabPage } from "../browser/NewTabPage"
import { SettingsPage } from "../browser/SettingsPage"
import { useBrowserStore } from "../stores/browser-store"
import { useDownloadsStore } from "../stores/downloads-store"

function App(): React.JSX.Element {
  return <BrowserApp />
}

function BrowserApp(): React.JSX.Element {
  const addressInput = useRef<HTMLInputElement>(null)
  const applySnapshot = useBrowserStore((state) => state.applySnapshot)
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  const themeMode = useBrowserStore((state) => state.themeMode)
  const applyDownloads = useDownloadsStore((state) => state.applyDownloads)

  useEffect(() => {
    if (themeMode === "system") document.documentElement.removeAttribute("data-theme")
    else document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  useEffect(() => {
    const apply = (snapshot: PhotonSnapshot): void => applySnapshot(snapshot)
    const unsubscribeSnapshot = window.photon.onSnapshot(apply)
    const unsubscribeFocus = window.photon.onFocusOmnibox(() => {
      addressInput.current?.focus()
      addressInput.current?.select()
    })

    void window.photon.getSnapshot().then(apply).catch(console.error)

    return () => {
      unsubscribeSnapshot()
      unsubscribeFocus()
    }
  }, [applySnapshot])

  useEffect(() => {
    const unsubscribe = window.photon.downloads.onChanged(applyDownloads)
    void window.photon.downloads.getSnapshot().then(applyDownloads).catch(console.error)
    return unsubscribe
  }, [applyDownloads])

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
