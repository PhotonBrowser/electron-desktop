export const INTERNAL_PAGE_DEFINITIONS = {
  "new-tab": { title: "New Tab", showInUrlBar: false },
  settings: { title: "Settings", showInUrlBar: true },
} as const

export type InternalPageId = keyof typeof INTERNAL_PAGE_DEFINITIONS
export type PhotonInternalUrl = `${string}://${InternalPageId}`
export type TabKind = "internal" | "web"

export interface InternalPageRegistry {
  newTabUrl: PhotonInternalUrl
  urlFor: (id: InternalPageId) => PhotonInternalUrl
  resolve: (url: string) => InternalPage | undefined
}

export interface InternalPage {
  id: InternalPageId
  title: string
  showInUrlBar: boolean
}

export function createInternalPageRegistry(packageName: string): InternalPageRegistry {
  const scheme = packageName.toLowerCase().replace(/[^a-z\d+.-]/g, "-")
  const urls = new Map<PhotonInternalUrl, InternalPage>(
    (Object.keys(INTERNAL_PAGE_DEFINITIONS) as InternalPageId[]).map((id) => [
      `${scheme}://${id}` as PhotonInternalUrl,
      { id, ...INTERNAL_PAGE_DEFINITIONS[id] },
    ]),
  )
  return {
    newTabUrl: urlsFor(scheme, "new-tab"),
    urlFor: (id) => urlsFor(scheme, id),
    resolve: (url) => urls.get(url as PhotonInternalUrl),
  }
}

function urlsFor(scheme: string, id: InternalPageId): PhotonInternalUrl {
  return `${scheme}://${id}` as PhotonInternalUrl
}

export function resolveTabKind(url: string, pages: InternalPageRegistry): TabKind {
  return pages.resolve(url) === undefined ? "web" : "internal"
}

export function isValidTabUrl(url: string, pages: InternalPageRegistry): boolean {
  if (pages.resolve(url)) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
