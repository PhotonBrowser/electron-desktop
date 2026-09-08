import assert from "node:assert/strict"
import test from "node:test"
import { createInternalPageRegistry, isValidTabUrl, resolveTabKind } from "./internal-pages.mts"
import { resolveNavigationUrl } from "./navigation-url.mts"

test("recognizes Photon internal pages without treating them as web URLs", () => {
  const pages = createInternalPageRegistry("photon-browser")
  assert.equal(resolveTabKind(pages.newTabUrl, pages), "internal")
  assert.equal(resolveTabKind("https://example.com", pages), "web")
  assert.equal(isValidTabUrl(pages.newTabUrl, pages), true)
  assert.equal(isValidTabUrl("photon-browser://settings", pages), true)
  assert.equal(resolveNavigationUrl(pages.newTabUrl, pages), pages.newTabUrl)
  assert.equal(
    resolveNavigationUrl("photon-browser://settings", pages),
    "photon-browser://settings",
  )
  assert.equal(pages.resolve("photon-browser://settings")?.showInUrlBar, true)
})
