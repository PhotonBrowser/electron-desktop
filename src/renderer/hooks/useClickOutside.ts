import { useEffect, type RefObject } from "react"

/** Shared dismissal behavior for custom chrome overlays that are not HeroUI components. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: MouseEvent): void => {
      const element = ref.current
      if (element && !element.contains(event.target as Node)) onDismiss()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onDismiss()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, onDismiss, ref])
}
