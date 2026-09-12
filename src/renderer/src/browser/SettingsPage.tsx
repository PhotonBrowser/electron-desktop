import { isThemeMode } from "@/shared/browser-settings"
import { useBrowserStore } from "@/renderer/src/stores/browser-store"
import { MemorySaverOptions } from "../features/settings/components/MemorySaverOptions"
import { SettingsSection } from "../features/settings/components/SettingsSection"
import { SettingsSelect } from "../features/settings/components/SettingsSelect"
import { SettingsSwitch } from "../features/settings/components/SettingsSwitch"

const themeOptions = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const

export function SettingsPage(): React.JSX.Element {
  const themeMode = useBrowserStore((state) => state.themeMode)
  const setThemeMode = useBrowserStore((state) => state.setThemeMode)
  const memorySaverEnabled = useBrowserStore((state) => state.memorySaverEnabled)
  const memorySaverLevel = useBrowserStore((state) => state.memorySaverLevel)
  const setMemorySaverEnabled = useBrowserStore((state) => state.setMemorySaverEnabled)
  const setMemorySaverLevel = useBrowserStore((state) => state.setMemorySaverLevel)

  return (
    <main className="photon-viewport photon-settings-page">
      <section aria-labelledby="settings-title" className="photon-settings-content">
        <header className="photon-settings-heading">
          <h1 id="settings-title">Settings</h1>
          <p>Make Photon work the way you do.</p>
        </header>

        <div className="photon-settings-panel">
          <SettingsSection
            control={
              <SettingsSwitch
                isSelected={memorySaverEnabled}
                label="Memory Saver"
                onChange={setMemorySaverEnabled}
              />
            }
            description="Free memory from tabs you’re not using. Tabs reload when you return to them."
            title="Memory Saver"
            titleId="memory-title"
          >
            <MemorySaverOptions
              enabled={memorySaverEnabled}
              value={memorySaverLevel}
              onChange={setMemorySaverLevel}
            />
          </SettingsSection>

          <SettingsSection
            control={
              <SettingsSelect
                label="Theme"
                options={themeOptions}
                value={themeMode}
                onChange={(value) => {
                  if (isThemeMode(value)) setThemeMode(value)
                }}
              />
            }
            description="Choose Photon’s appearance."
            title="Appearance"
            titleId="appearance-title"
          />
        </div>
      </section>
    </main>
  )
}
