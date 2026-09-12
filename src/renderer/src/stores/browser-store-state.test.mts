import assert from "node:assert/strict"
import test from "node:test"
import type { BrowserTab, PhotonBrowserUpdateEnvelope, TabId } from "@/shared/photon-api"
import { applyBrowserUpdates } from "./browser-store-state.ts"

const tab = (id: string, title: string): BrowserTab => ({
  id: id as TabId,
  kind: "web",
  internalPage: null,
  showInUrlBar: true,
  url: `https://${id}.example/`,
  title,
  loading: false,
  lifecycleState: "active",
  canGoBack: false,
  canGoForward: false,
  crashed: false,
  error: null,
})

test("applies ordered tab updates without mutating the previous snapshot", () => {
  const first = tab("tab-1", "First")
  const second = tab("tab-2", "Second")
  const current = { revision: 1, tabs: [first, second], activeTabId: first.id, isMaximized: false }
  const updates: PhotonBrowserUpdateEnvelope[] = [
    {
      revision: 2,
      update: { type: "tab-updated", tabId: first.id, changes: { title: "Updated" } },
    },
    { revision: 3, update: { type: "active-tab-changed", activeTabId: second.id } },
    { revision: 4, update: { type: "window-maximized-changed", isMaximized: true } },
  ]

  const next = applyBrowserUpdates(current, updates)

  assert.equal(next.tabs[0]?.title, "Updated")
  assert.equal(next.activeTabId, second.id)
  assert.equal(next.isMaximized, true)
  assert.equal(current.tabs[0]?.title, "First")
  assert.equal(current.revision, 1)
})

test("advances the revision when an update targets a missing tab", () => {
  const current = { revision: 1, tabs: [], activeTabId: "tab-1" as TabId, isMaximized: false }
  const next = applyBrowserUpdates(current, [
    {
      revision: 2,
      update: { type: "tab-updated", tabId: "tab-1" as TabId, changes: { title: "No-op" } },
    },
  ])

  assert.equal(next.revision, 2)
  assert.deepEqual(next.tabs, [])
})
