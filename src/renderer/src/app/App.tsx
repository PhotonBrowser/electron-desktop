import { useCallback, useRef, useState } from "react"
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
import { FindBar } from "../features/find/components/FindBar"
import type { FindController } from "../features/find/find.types"
import type { TabId } from "@/shared/photon-api"

function App(): React.JSX.Element {
  const addressInput = useRef<HTMLInputElement>(null)
  const tabs = useBrowserStore((state) => state.tabs)
  const activeTabId = useBrowserStore((state) => state.activeTabId)
  const activeTab = useActiveTab()
  const themeMode = useBrowserStore((state) => state.themeMode)
  const memorySaverEnabled = useBrowserStore((state) => state.memorySaverEnabled)
  const memorySaverLevel = useBrowserStore((state) => state.memorySaverLevel)
  const [findController, setFindController] = useState<FindController | null>(null)
  const setActiveFindController = useCallback((next: FindController | null, tabId: TabId): void => {
    setFindController((current) => {
      if (next) return next
      return current?.tabId === tabId ? null : current
    })
  }, [])

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
              <BrowserView
                key={tab.id}
                active={tab.id === activeTabId}
                tab={tab}
                onFindControllerChange={setActiveFindController}
              />
            ))}
          <div className="browser-overlay-layer">
            {activeTab?.internalPage === "new-tab" && <NewTabPage />}
            {activeTab?.internalPage === "settings" && <SettingsPage />}
            <FindBar controller={findController} loading={activeTab?.loading ?? false} />
            <PerformanceOverlay />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
