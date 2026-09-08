import assert from "node:assert/strict"
import test from "node:test"
import {
  downloadProgress,
  formatBytes,
  nextAvailableFilename,
  sanitizeDownloadFilename,
} from "./download-filename.mts"

test("formats bytes and progress", () => {
  assert.equal(formatBytes(12.4 * 1024 * 1024), "12.4 MB")
  assert.equal(downloadProgress(5, 10), 0.5)
  assert.equal(downloadProgress(5, null), null)
})

test("keeps safe filenames inside collision sequence", () => {
  assert.equal(sanitizeDownloadFilename("../file.zip"), "file.zip")
  assert.equal(sanitizeDownloadFilename("..\\file.zip"), "file.zip")
  assert.equal(
    nextAvailableFilename("file.zip", (name) => name !== "file (2).zip"),
    "file (2).zip",
  )
})
