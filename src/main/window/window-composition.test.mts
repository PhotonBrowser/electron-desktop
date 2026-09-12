import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import test from "node:test"
import type { BaseWindow, WebContentsView } from "electron"
import { WindowComposition } from "./window-composition.ts"

interface FakeContentView {
  addChildView: (view: WebContentsView) => void
  removeChildView: (view: WebContentsView) => void
}

function createWindow(isDestroyed: () => boolean, contentView: FakeContentView): BaseWindow {
  const browserWindow = new EventEmitter()
  Object.assign(browserWindow, { contentView, isDestroyed })
  return browserWindow as unknown as BaseWindow
}

function createChromeView(close: () => void): WebContentsView {
  return {
    webContents: {
      close,
      isDestroyed: () => false,
    },
  } as unknown as WebContentsView
}

test("does not touch a destroyed window during disposal", () => {
  let destroyed = true
  let removed = 0
  let closed = 0
  const contentView: FakeContentView = {
    addChildView: () => undefined,
    removeChildView: () => {
      removed += 1
    },
  }
  const composition = new WindowComposition(
    createWindow(() => destroyed, contentView),
    createChromeView(() => {
      closed += 1
    }),
  )

  composition.dispose()
  composition.dispose()
  destroyed = false

  assert.equal(removed, 0)
  assert.equal(closed, 1)
})

test("removes the chrome view before closing live window contents", () => {
  let removed = 0
  let closed = 0
  const contentView: FakeContentView = {
    addChildView: () => undefined,
    removeChildView: () => {
      removed += 1
    },
  }
  const composition = new WindowComposition(
    createWindow(() => false, contentView),
    createChromeView(() => {
      closed += 1
    }),
  )

  composition.dispose()

  assert.equal(removed, 1)
  assert.equal(closed, 1)
})
