import { Popover as HeroPopover } from "@heroui/react"
import type { PopoverContentProps } from "@heroui/react"
import { useState, type ReactNode } from "react"

type PopoverPlacement = NonNullable<PopoverContentProps["placement"]>

export interface PopoverRenderProps {
  close: () => void
}

export interface PopoverProps {
  trigger: ReactNode
  children: ReactNode | ((props: PopoverRenderProps) => ReactNode)
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  placement?: PopoverPlacement
}

export function Popover({
  trigger,
  children,
  isOpen: controlledOpen,
  onOpenChange,
  placement = "bottom end",
}: PopoverProps): React.JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = controlledOpen ?? uncontrolledOpen
  const handleOpenChange = (nextOpen: boolean): void => {
    setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  const close = (): void => handleOpenChange(false)

  return (
    <HeroPopover isOpen={isOpen} onOpenChange={handleOpenChange}>
      <HeroPopover.Trigger>{trigger}</HeroPopover.Trigger>
      <HeroPopover.Content
        placement={placement}
        className="z-50 origin-top-right rounded-lg border border-line bg-panel text-fg shadow-elevated opacity-100 transition-[opacity,transform] duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[entering]:scale-95 data-[entering]:opacity-0 data-[exiting]:scale-95 data-[exiting]:opacity-0"
      >
        <HeroPopover.Dialog>
          {typeof children === "function" ? children({ close }) : children}
        </HeroPopover.Dialog>
      </HeroPopover.Content>
    </HeroPopover>
  )
}
