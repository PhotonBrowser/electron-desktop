import assert from "node:assert/strict"
import test from "node:test"
import type { WebContents } from "electron"
import type { PhotonBrowserUpdate, TabId } from "@/shared/photon-api"
import { createBrowserUpdateQueue } from "./browser-update-queue.ts"

test("coalesces same-tab updates while preserving the newest revision", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] })
  const sent: unknown[][] = []
  const chromeWebContents = {
    isDestroyed: () => false,
    send: (...args: unknown[]) => sent.push(args),
  } as unknown as WebContents
  const queue = createBrowserUpdateQueue(chromeWebContents)
  const firstUpdate: PhotonBrowserUpdate = {
    type: "tab-updated",
    tabId: "tab-1" as TabId,
    changes: { title: "Loading" },
  }
  const secondUpdate: PhotonBrowserUpdate = {
    type: "tab-updated",
    tabId: "tab-1" as TabId,
    changes: { loading: false },
  }

  queue.enqueue(firstUpdate)
  queue.enqueue(secondUpdate)
  context.mock.timers.tick(16)

  assert.equal(queue.getRevision(), 2)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0]?.[1], [
    {
      revision: 2,
      update: {
        type: "tab-updated",
        tabId: "tab-1",
        changes: { title: "Loading", loading: false },
      },
    },
  ])
  queue.dispose()
})
