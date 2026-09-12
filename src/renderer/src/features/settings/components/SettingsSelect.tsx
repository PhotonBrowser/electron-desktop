import { ListBox, Select } from "@heroui/react"

export interface SettingsSelectOption {
  id: string
  label: string
}

interface SettingsSelectProps {
  label: string
  value: string
  options: readonly SettingsSelectOption[]
  onChange: (value: string) => void
}

export function SettingsSelect({
  label,
  value,
  options,
  onChange,
}: SettingsSelectProps): React.JSX.Element {
  return (
    <Select
      aria-label={label}
      className="photon-settings-select"
      selectedKey={value}
      onSelectionChange={(key) => {
        if (typeof key === "string") onChange(key)
      }}
    >
      <Select.Trigger className="photon-settings-select-trigger">
        <Select.Value />
        <Select.Indicator className="photon-settings-select-indicator" />
      </Select.Trigger>
      <Select.Popover className="photon-popover-surface photon-settings-select-popover">
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option.id} className="photon-settings-select-item" id={option.id}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}
