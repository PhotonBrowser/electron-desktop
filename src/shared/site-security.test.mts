import assert from "node:assert/strict"
import test from "node:test"
import { getSiteSecurity } from "./site-security.ts"

test("reports the host and secure connection for HTTPS sites", () => {
  assert.deepEqual(getSiteSecurity("https://chatgpt.com/conversations"), {
    host: "chatgpt.com",
    isSecure: true,
  })
})

test("reports HTTP sites as not secure", () => {
  assert.deepEqual(getSiteSecurity("http://localhost:3000"), {
    host: "localhost:3000",
    isSecure: false,
  })
})

test("does not expose security status for internal or invalid URLs", () => {
  assert.equal(getSiteSecurity("photon://new-tab"), null)
  assert.equal(getSiteSecurity("not a URL"), null)
})
