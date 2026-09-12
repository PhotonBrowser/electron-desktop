import { useEffect, type RefObject } from "react"
import type { PhotonBrowserUpdateEnvelope } from "@/shared/photon-api"
import { logger } from "@/shared/logger"
import { useBrowserStore } from "../../stores/browser-store"

export function useBrowserSync(addressInput: RefObject<HTMLInputElement | null>): void {
  const applySnapshot = useBrowserStore((state) => state.applySnapshot)
  const applyUpdates = useBrowserStore((state) => state.applyUpdates)

  useEffect(() => {
    const pendingUpdates: PhotonBrowserUpdateEnvelope[] = []
    let updateFrame: number | undefined
    let focusFrame: number | undefined
    let disposed = false
    const flushUpdates = (): void => {
      updateFrame = undefined
      if (disposed || pendingUpdates.length === 0) return
      applyUpdates(pendingUpdates.splice(0))
    }
    const handleUpdates = (updates: PhotonBrowserUpdateEnvelope[]): void => {
      if (disposed) return
      pendingUpdates.push(...updates)
      if (updateFrame === undefined) updateFrame = window.requestAnimationFrame(flushUpdates)
    }
    const unsubscribeUpdates = window.photon.onUpdates(handleUpdates)
    const unsubscribeFocus = window.photon.onFocusOmnibox(() => {
      if (disposed) return
      const input = addressInput.current
      input?.focus()
      if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame)
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = undefined
        if (disposed) return
        const currentInput = addressInput.current
        if (currentInput?.value) currentInput.select()
      })
    })

    void window.photon
      .getSnapshot()
      .then((snapshot) => {
        if (!disposed) applySnapshot(snapshot)
      })
      .catch((error: unknown) => {
        if (!disposed) logger.error("snapshot sync failed", error)
      })

    return () => {
      disposed = true
      unsubscribeUpdates()
      unsubscribeFocus()
      if (updateFrame !== undefined) window.cancelAnimationFrame(updateFrame)
      if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame)
    }
  }, [addressInput, applySnapshot, applyUpdates])
}
