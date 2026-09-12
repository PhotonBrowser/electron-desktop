import { useEffect } from "react"
import { logger } from "@/shared/logger"
import type { MemorySaverLevel } from "@/shared/photon-api"

export function useMemorySaverSync(enabled: boolean, level: MemorySaverLevel): void {
  useEffect(() => {
    void window.photon.memorySaver
      .setSettings({ enabled, level })
      .catch((error: unknown) => logger.error("memory saver sync failed", error))
  }, [enabled, level])
}
