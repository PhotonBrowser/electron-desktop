import { useEffect, useRef, type RefObject } from "react"

/** Shared dismissal behavior for custom chrome overlays that are not HeroUI components. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  enabled = true,
): void {
  const onDismissRef = useRef(onDismiss)

  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  useEffect(() => {
    if (!enabled) return

    const handlePointerDown = (event: MouseEvent): void => {
      const element = ref.current
      if (!element || !(event.target instanceof Node)) return
      if (!element.contains(event.target)) onDismissRef.current()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return
      event.preventDefault()
      onDismissRef.current()
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled, ref])
}
