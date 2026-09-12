import { Dropdown as HeroDropdown } from "@heroui/react"
import type { DropdownPopoverProps } from "@heroui/react"
import { useState, type ReactNode } from "react"

type DropdownPlacement = NonNullable<DropdownPopoverProps["placement"]>

export interface DropDownItem {
  id: string
  label: string
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  /** Adds a separator before this item without changing HeroUI menu semantics. */
  separator?: boolean
}

export interface DropDownProps {
  trigger: ReactNode
  triggerLabel: string
  triggerClassName?: string
  items: readonly DropDownItem[]
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  placement?: DropdownPlacement
}

export function DropDown({
  trigger,
  triggerLabel,
  triggerClassName,
  items,
  isOpen: controlledOpen,
  onOpenChange,
  placement = "bottom end",
}: DropDownProps): React.JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = controlledOpen ?? uncontrolledOpen
  const handleOpenChange = (nextOpen: boolean): void => {
    setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <HeroDropdown isOpen={isOpen} onOpenChange={handleOpenChange}>
      <HeroDropdown.Trigger
        aria-label={triggerLabel}
        className={`button button--icon-only button--sm button--ghost photon-icon-button photon-dropdown-trigger ${triggerClassName ?? ""}`.trim()}
        type="button"
      >
        {trigger}
      </HeroDropdown.Trigger>
      <HeroDropdown.Popover
        placement={placement}
        className="photon-dropdown-popover z-50 min-w-44 rounded-lg border border-line bg-panel p-1 text-fg shadow-elevated opacity-100 transition-[opacity,transform] duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[entering]:scale-95 data-[entering]:opacity-0 data-[exiting]:scale-95 data-[exiting]:opacity-0"
      >
        <HeroDropdown.Menu aria-label="Menu">
          {items.map((item) => (
            <HeroDropdown.Item
              key={item.id}
              id={item.id}
              isDisabled={item.disabled ?? false}
              onAction={() => {
                item.onClick?.()
                if (controlledOpen === undefined) setUncontrolledOpen(false)
              }}
              className={[
                "photon-dropdown-item flex items-center outline-none",
                "data-[focused]:bg-default data-[focused]:text-default-foreground",
                item.separator ? "mt-1 border-t border-line pt-1" : "",
              ].join(" ")}
            >
              {item.icon ? (
                <span
                  className="flex size-4 shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </HeroDropdown.Item>
          ))}
        </HeroDropdown.Menu>
      </HeroDropdown.Popover>
    </HeroDropdown>
  )
}
