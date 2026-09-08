export interface SiteSecurity {
  host: string
  isSecure: boolean
}

export function getSiteSecurity(url: string): SiteSecurity | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null

    return {
      host: parsed.host,
      isSecure: parsed.protocol === "https:",
    }
  } catch {
    return null
  }
}
