import { Button, type ButtonProps } from "@heroui/react"
import { forwardRef, type ReactNode } from "react"

interface IconButtonProps extends Omit<ButtonProps, "aria-label" | "children" | "isIconOnly"> {
  ariaLabel: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { ariaLabel, children, className, ...props },
  ref,
): React.JSX.Element {
  return (
    <Button
      {...props}
      ref={ref}
      aria-label={ariaLabel}
      className={`photon-icon-button ${className ?? ""}`.trim()}
      isIconOnly
    >
      {children}
    </Button>
  )
})
