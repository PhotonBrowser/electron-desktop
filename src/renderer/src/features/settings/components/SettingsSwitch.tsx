import { Switch } from "@heroui/react"

interface SettingsSwitchProps {
  label: string
  isSelected: boolean
  onChange: (selected: boolean) => void
}

export function SettingsSwitch({
  label,
  isSelected,
  onChange,
}: SettingsSwitchProps): React.JSX.Element {
  return (
    <Switch
      aria-label={label}
      className="photon-settings-switch"
      isSelected={isSelected}
      onChange={onChange}
    >
      <Switch.Content className="photon-settings-switch-content">
        <Switch.Control className="photon-settings-switch-control">
          <Switch.Thumb className="photon-settings-switch-thumb" />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  )
}
