import type {
  DownloadId,
  MemorySaverSettings,
  PhotonWebviewEventChanges,
  TabId,
} from "@/shared/photon-api"
import { isMemorySaverLevel } from "../../shared/browser-settings.ts"

export function isString(value: unknown): value is string {
  return typeof value === "string"
}

export function isTabId(value: unknown): value is TabId {
  return typeof value === "string" && /^tab-\d+$/.test(value)
}

export function isTabIdList(value: unknown): value is TabId[] {
  if (!Array.isArray(value) || !value.every(isTabId)) return false
  return new Set(value).size === value.length
}

export function isDownloadId(value: unknown): value is DownloadId {
  return typeof value === "string" && /^download-\d+$/.test(value)
}

export function isWebviewEventChanges(value: unknown): value is PhotonWebviewEventChanges {
  if (typeof value !== "object" || value === null) return false
  const changes = value as Record<string, unknown>
  return (
    isStringOrUndefined(changes.url) &&
    isStringOrUndefined(changes.title) &&
    isNullableStringOrUndefined(changes.faviconUrl) &&
    isBooleanOrUndefined(changes.loading) &&
    isBooleanOrUndefined(changes.canGoBack) &&
    isBooleanOrUndefined(changes.canGoForward) &&
    isBooleanOrUndefined(changes.crashed) &&
    isNullableStringOrUndefined(changes.error)
  )
}

export function isMemorySaverSettings(value: unknown): value is MemorySaverSettings {
  if (typeof value !== "object" || value === null) return false
  const settings = value as Partial<Record<keyof MemorySaverSettings, unknown>>
  return typeof settings.enabled === "boolean" && isMemorySaverLevel(settings.level)
}

function isStringOrUndefined(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string"
}

function isNullableStringOrUndefined(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string"
}

function isBooleanOrUndefined(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean"
}
