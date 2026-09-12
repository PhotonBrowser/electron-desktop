import { isIP } from "node:net"
import { BROWSER_DEFAULTS } from "../../shared/browser-constants.ts"
import type { InternalPageRegistry } from "./internal-pages.mts"

const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"])
const SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i

export function resolveNavigationUrl(input: string, pages?: InternalPageRegistry): string {
  const value = input.trim()
  if (!value) return createSearchUrl(value)

  if (pages?.resolve(value)) return value

  if (SCHEME_PATTERN.test(value)) {
    const url = new URL(value)
    if (SUPPORTED_PROTOCOLS.has(url.protocol)) return value
    return createSearchUrl(value)
  }

  const url = createDirectUrl(value)
  return url ?? createSearchUrl(value)
}

function createDirectUrl(value: string): string | undefined {
  if (/\s/.test(value)) return undefined

  try {
    const parsed = new URL("http://" + value)
    const hostname = parsed.hostname.replace(/^\[|\]$/g, "")
    const isLocalhost = hostname === "localhost"
    const isIpAddress = isIP(hostname) !== 0
    const isDomain = hostname.includes(".")

    if (!isLocalhost && !isIpAddress && !isDomain) return undefined

    const protocol = isLocalhost || isIpAddress ? "http:" : "https:"
    parsed.protocol = protocol
    return parsed.toString()
  } catch {
    return undefined
  }
}

function createSearchUrl(query: string): string {
  const searchUrl = new URL(BROWSER_DEFAULTS.searchEngineUrl)
  searchUrl.search = new URLSearchParams({ q: query }).toString()
  return searchUrl.toString()
}
