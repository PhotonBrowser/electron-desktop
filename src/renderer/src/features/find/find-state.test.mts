import assert from "node:assert/strict"
import test from "node:test"
import { EMPTY_FIND_STATE, resultState } from "./find-state.ts"

test("empty find state clears query and result counts", () => {
  assert.deepEqual(EMPTY_FIND_STATE, { query: "", activeMatch: 0, matches: 0 })
})

test("find result state preserves the active match and total", () => {
  assert.deepEqual(resultState("Photon", 2, 14), {
    query: "Photon",
    activeMatch: 2,
    matches: 14,
  })
})
