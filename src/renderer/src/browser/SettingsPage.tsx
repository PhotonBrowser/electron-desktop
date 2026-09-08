import { useBrowserStore, type ThemeMode } from "../stores/browser-store"

export function SettingsPage(): React.JSX.Element {
  const themeMode = useBrowserStore((state) => state.themeMode)
  const setThemeMode = useBrowserStore((state) => state.setThemeMode)

  return (
    <main className="photon-viewport photon-settings-page">
      <section className="photon-settings-content">
        <h1>Settings</h1>
        <label className="photon-settings-row">
          <span>
            <strong>Theme</strong>
            <small>Choose Photon’s appearance.</small>
          </span>
          <select
            aria-label="Theme"
            value={themeMode}
            onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>
    </main>
  )
}
