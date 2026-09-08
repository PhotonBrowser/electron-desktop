import assert from "node:assert/strict"
import test from "node:test"
import { resolveNavigationUrl } from "./navigation-url.mts"

test("resolves plain words as Google searches", () => {
  assert.equal(resolveNavigationUrl("hi"), "https://www.google.com/search?q=hi")
})

test("encodes multi-word and special-character searches", () => {
  assert.equal(
    resolveNavigationUrl("best browser & engine"),
    "https://www.google.com/search?q=best+browser+%26+engine",
  )
})

test("resolves domains over HTTPS", () => {
  assert.equal(resolveNavigationUrl("github.com"), "https://github.com/")
  assert.equal(resolveNavigationUrl("docs.github.com"), "https://docs.github.com/")
})

test("resolves localhost and IP addresses over HTTP", () => {
  assert.equal(resolveNavigationUrl("localhost"), "http://localhost/")
  assert.equal(resolveNavigationUrl("localhost:3000"), "http://localhost:3000/")
  assert.equal(resolveNavigationUrl("127.0.0.1"), "http://127.0.0.1/")
  assert.equal(resolveNavigationUrl("127.0.0.1:8080"), "http://127.0.0.1:8080/")
  assert.equal(resolveNavigationUrl("[::1]:3000"), "http://[::1]:3000/")
})

test("preserves explicit HTTP and HTTPS URLs", () => {
  assert.equal(resolveNavigationUrl("http://localhost:3000/app"), "http://localhost:3000/app")
  assert.equal(resolveNavigationUrl("https://example.com/test"), "https://example.com/test")
})

test("trims input before resolving", () => {
  assert.equal(resolveNavigationUrl("  github.com  "), "https://github.com/")
})
