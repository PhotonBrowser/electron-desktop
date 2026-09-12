import { Radio, RadioGroup } from "@heroui/react"
import { isMemorySaverLevel } from "@/shared/browser-settings"
import type { MemorySaverLevel } from "@/shared/photon-api"

const options: ReadonlyArray<{ value: MemorySaverLevel; title: string; description: string }> = [
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

interface MemorySaverOptionsProps {
  enabled: boolean
  value: MemorySaverLevel
  onChange: (value: MemorySaverLevel) => void
}

export function MemorySaverOptions({
  enabled,
  value,
  onChange,
}: MemorySaverOptionsProps): React.JSX.Element {
  return (
    <RadioGroup
      aria-label="Memory saving level"
      className="photon-memory-options"
      isDisabled={!enabled}
      value={value}
      onChange={(nextValue) => {
        if (isMemorySaverLevel(nextValue)) onChange(nextValue)
      }}
    >
      {options.map((option) => (
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
  )
}
