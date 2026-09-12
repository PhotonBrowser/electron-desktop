import assert from "node:assert/strict"
import test from "node:test"
import type { BrowserDownload } from "@/shared/photon-api"
import {
  formatBytes,
  getDownloadProgress,
  isActiveDownload,
  sortDownloads,
} from "./downloads.utils.ts"

const download = (changes: Partial<BrowserDownload> = {}): BrowserDownload => ({
  id: "download-1" as BrowserDownload["id"],
  filename: "file.zip",
  sourceUrl: "https://example.com/file.zip",
  receivedBytes: 0,
  totalBytes: null,
  state: "starting",
  startedAt: 1,
  ...changes,
})

test("formats byte sizes compactly", () => {
  assert.equal(formatBytes(842 * 1024), "842 KB")
  assert.equal(formatBytes(4.2 * 1024 ** 2), "4.2 MB")
  assert.equal(formatBytes(-1), "—")
})

test("calculates safe known and unknown progress", () => {
  assert.equal(getDownloadProgress(download({ receivedBytes: 34, totalBytes: 50 })), 0.68)
  assert.equal(getDownloadProgress(download({ receivedBytes: 34, totalBytes: null })), null)
  assert.equal(getDownloadProgress(download({ receivedBytes: Number.NaN, totalBytes: 50 })), 0)
})

test("sorts newest downloads first and identifies active states", () => {
  const older = download({ id: "download-1" as BrowserDownload["id"], startedAt: 1 })
  const newer = download({
    id: "download-2" as BrowserDownload["id"],
    startedAt: 2,
    state: "completed",
  })
  assert.deepEqual(
    sortDownloads([older, newer]).map(({ id }) => id),
    ["download-2", "download-1"],
  )
  assert.equal(isActiveDownload(older), true)
  assert.equal(isActiveDownload(newer), false)
})
