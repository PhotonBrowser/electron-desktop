import { ListBox, Radio, RadioGroup, Select, Switch } from "@heroui/react"
import type { MemorySaverLevel } from "@/shared/photon-api"
import { isMemorySaverLevel, isThemeMode } from "@/shared/browser-settings"
import { useBrowserStore } from "@/renderer/src/stores/browser-store"

const memorySaverOptions: ReadonlyArray<{
  value: MemorySaverLevel
  title: string
  description: string
}> = [
  {
    value: "moderate",
    title: "Moderate",
    description: "Tabs become inactive after a longer period of time.",
  },
  {
    value: "balanced",
    title: "Balanced",
    description: "Tabs become inactive after an optimal period of time.",
  },
  {
    value: "maximum",
    title: "Maximum",
    description: "Tabs become inactive after a shorter period of time.",
  },
]

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
          <section aria-labelledby="memory-title" className="photon-settings-group">
            <div className="photon-settings-group-header">
              <div className="photon-settings-copy">
                <h2 id="memory-title">Memory Saver</h2>
                <p>Free memory from tabs you’re not using. Tabs reload when you return to them.</p>
              </div>
              <Switch
                aria-label="Memory Saver"
                className="photon-memory-switch"
                isSelected={memorySaverEnabled}
                onChange={setMemorySaverEnabled}
              >
                <Switch.Content className="photon-memory-switch-content">
                  <Switch.Control className="photon-memory-switch-control">
                    <Switch.Thumb className="photon-memory-switch-thumb" />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </div>

            <RadioGroup
              aria-label="Memory saving level"
              className="photon-memory-options"
              isDisabled={!memorySaverEnabled}
              value={memorySaverLevel}
              onChange={(value) => {
                if (isMemorySaverLevel(value)) setMemorySaverLevel(value)
              }}
            >
              {memorySaverOptions.map((option) => (
                <Radio key={option.value} value={option.value}>
                  <Radio.Content className="photon-memory-option">
                    <Radio.Control className="photon-memory-radio-control">
                      <Radio.Indicator className="photon-memory-radio-indicator" />
                    </Radio.Control>
                    <span className="photon-memory-option-copy">
                      <span className="photon-memory-option-title">
                        {option.title}
                        {option.value === "balanced" && " (recommended)"}
                      </span>
                      <span>{option.description}</span>
                    </span>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
          </section>

          <section
            aria-labelledby="appearance-title"
            className="photon-settings-group photon-settings-row"
          >
            <div className="photon-settings-copy">
              <h2 id="appearance-title">Appearance</h2>
              <p>Choose Photon’s appearance.</p>
            </div>
            <Select
              aria-label="Theme"
              className="photon-theme-select"
              selectedKey={themeMode}
              onSelectionChange={(key) => {
                if (typeof key === "string" && isThemeMode(key)) setThemeMode(key)
              }}
            >
              <Select.Trigger className="photon-theme-trigger">
                <Select.Value />
                <Select.Indicator className="photon-theme-indicator" />
              </Select.Trigger>
              <Select.Popover className="photon-popover-surface photon-theme-popover">
                <ListBox>
                  <ListBox.Item id="system">System</ListBox.Item>
                  <ListBox.Item id="light">Light</ListBox.Item>
                  <ListBox.Item id="dark">Dark</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </section>
        </div>
      </section>
    </main>
  )
}
