import { useRef } from "react"
import { Titlebar } from "../browser/Titlebar"
import { Toolbar } from "../browser/Toolbar"
import { NewTabPage } from "../browser/NewTabPage"
import { SettingsPage } from "../browser/SettingsPage"
import { PerformanceOverlay } from "../browser/PerformanceOverlay"
import { BrowserView } from "../features/browser/components/BrowserView"
import { useActiveTab } from "../features/browser/hooks/useActiveTab"
import { useBrowserStore } from "../stores/browser-store"
import { useBrowserSync } from "./hooks/useBrowserSync"
import { useMemorySaverSync } from "./hooks/useMemorySaverSync"
import { usePhotonTheme } from "./hooks/usePhotonTheme"

function App(): React.JSX.Element {
  const addressInput = useRef<HTMLInputElement>(null)
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = useActiveTab()
  const themeMode = useBrowserStore((state) => state.themeMode)
  const memorySaverEnabled = useBrowserStore((state) => state.memorySaverEnabled)
  const memorySaverLevel = useBrowserStore((state) => state.memorySaverLevel)

  useBrowserSync(addressInput)
  usePhotonTheme(themeMode)
  useMemorySaverSync(memorySaverEnabled, memorySaverLevel)

  return (
    <div className="photon-shell">
      <section className="photon-chrome">
        <Titlebar />
        <Toolbar addressInput={addressInput} />
      </section>
      <main className="photon-page-area">
        <div className="photon-page-surface">
          {tabs
            .filter((tab) => tab.kind === "web")
            .map((tab) => (
              <BrowserView key={tab.id} active={tab.id === activeTabId} tab={tab} />
            ))}
          <div className="browser-overlay-layer">
            {activeTab?.internalPage === "new-tab" && <NewTabPage />}
            {activeTab?.internalPage === "settings" && <SettingsPage />}
            <PerformanceOverlay />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
