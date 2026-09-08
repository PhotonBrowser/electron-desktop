import assert from "node:assert/strict"
import test from "node:test"
import { BROWSER_LAYOUT, getBrowserContentBounds } from "../../shared/browser-layout.ts"

test("derives the page bounds from the semantic chrome layout", () => {
  assert.deepEqual(getBrowserContentBounds({ width: 1100, height: 760 }), {
    x: 4,
    y: 76,
    width: 1092,
    height: 680,
  })
})

test("never returns negative page dimensions while a window is being resized", () => {
  assert.deepEqual(getBrowserContentBounds({ width: 2, height: 70 }), {
    x: BROWSER_LAYOUT.contentInset,
    y: BROWSER_LAYOUT.chromeHeight + BROWSER_LAYOUT.contentInset,
    width: 0,
    height: 0,
  })
})
