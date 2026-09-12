import assert from "node:assert/strict"
import test from "node:test"
import {
  isMemorySaverSettings,
  isTabId,
  isTabIdList,
  isWebviewEventChanges,
} from "./ipc-validation.ts"

test("accepts only valid Photon tab identifiers and unique reorder lists", () => {
  assert.equal(isTabId("tab-12"), true)
  assert.equal(isTabId("tab-other"), false)
  assert.equal(isTabIdList(["tab-1", "tab-2"]), true)
  assert.equal(isTabIdList(["tab-1", "tab-1"]), false)
})

test("validates webview changes and memory saver settings at the IPC boundary", () => {
  assert.equal(isWebviewEventChanges({ title: "Example", faviconUrl: null, loading: false }), true)
  assert.equal(isWebviewEventChanges({ loading: "yes" }), false)
  assert.equal(isMemorySaverSettings({ enabled: true, level: "balanced" }), true)
  assert.equal(isMemorySaverSettings({ enabled: true, level: "unsafe" }), false)
})
