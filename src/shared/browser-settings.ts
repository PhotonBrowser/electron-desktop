import type { MemorySaverLevel } from "./photon-api"

export type ThemeMode = "system" | "light" | "dark"

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark"
}

export function isMemorySaverLevel(value: unknown): value is MemorySaverLevel {
  return value === "moderate" || value === "balanced" || value === "maximum"
}
