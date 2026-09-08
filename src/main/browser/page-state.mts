import { randomUUID } from "node:crypto"
import { unlink, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { WebContents } from "electron"

interface SavedPageField {
  index: number
  kind: "input" | "textarea" | "select" | "contenteditable"
  type?: string
  value?: string | string[]
  checked?: boolean
  selectionStart?: number | null
  selectionEnd?: number | null
}

interface SavedPageState {
  scrollX: number
  scrollY: number
  fields: SavedPageField[]
}

const CAPTURE_PAGE_STATE_SCRIPT = `/* photon:memory-saver:capture */
(() => {
  const fields = Array.from(
    document.querySelectorAll('input, textarea, select, [contenteditable="true"]'),
  )

  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    fields: fields.map((element, index) => {
      if (element instanceof HTMLInputElement) {
        const canRestoreValue = element.type !== "password" && element.type !== "file"
        return {
          index,
          kind: "input",
          type: element.type,
          ...(canRestoreValue ? { value: element.value } : {}),
          ...(element.type === "checkbox" || element.type === "radio"
            ? { checked: element.checked }
            : {}),
          ...(canRestoreValue
            ? { selectionStart: element.selectionStart, selectionEnd: element.selectionEnd }
            : {}),
        }
      }

      if (element instanceof HTMLTextAreaElement) {
        return {
          index,
          kind: "textarea",
          value: element.value,
          selectionStart: element.selectionStart,
          selectionEnd: element.selectionEnd,
        }
      }

      if (element instanceof HTMLSelectElement) {
        return {
          index,
          kind: "select",
          value: element.multiple
            ? Array.from(element.selectedOptions, (option) => option.value)
            : element.value,
        }
      }

      return { index, kind: "contenteditable", value: element.innerHTML }
    }),
  }
})()`

const RESTORE_PAGE_STATE_SCRIPT = `/* photon:memory-saver:restore */
(state) => {
  const fields = Array.from(
    document.querySelectorAll('input, textarea, select, [contenteditable="true"]'),
  )

  for (const savedField of state.fields) {
    const element = fields[savedField.index]
    if (!element) continue

    if (savedField.kind === "input" && element instanceof HTMLInputElement) {
      if (element.type === "password" || element.type === "file") continue
      if (typeof savedField.value === "string") element.value = savedField.value
      if (
        (element.type === "checkbox" || element.type === "radio") &&
        typeof savedField.checked === "boolean"
      ) {
        element.checked = savedField.checked
      }
      if (typeof savedField.selectionStart === "number" && typeof savedField.selectionEnd === "number") {
        element.setSelectionRange(savedField.selectionStart, savedField.selectionEnd)
      }
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      continue
    }

    if (savedField.kind === "textarea" && element instanceof HTMLTextAreaElement) {
      if (typeof savedField.value === "string") element.value = savedField.value
      if (typeof savedField.selectionStart === "number" && typeof savedField.selectionEnd === "number") {
        element.setSelectionRange(savedField.selectionStart, savedField.selectionEnd)
      }
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      continue
    }

    if (savedField.kind === "select" && element instanceof HTMLSelectElement) {
      if (Array.isArray(savedField.value)) {
        const values = new Set(savedField.value)
        for (const option of element.options) option.selected = values.has(option.value)
      } else if (typeof savedField.value === "string") {
        element.value = savedField.value
      }
      element.dispatchEvent(new Event("change", { bubbles: true }))
      continue
    }

    if (savedField.kind === "contenteditable" && element instanceof HTMLElement) {
      if (typeof savedField.value === "string") element.innerHTML = savedField.value
      element.dispatchEvent(new Event("input", { bubbles: true }))
    }
  }

  window.scrollTo(state.scrollX, state.scrollY)
}`

function isSavedPageField(value: unknown): value is SavedPageField {
  if (typeof value !== "object" || value === null) return false
  const field = value as Partial<SavedPageField>
  const validKind =
    field.kind === "input" ||
    field.kind === "textarea" ||
    field.kind === "select" ||
    field.kind === "contenteditable"
  const validValue =
    field.value === undefined ||
    typeof field.value === "string" ||
    (Array.isArray(field.value) && field.value.every((value) => typeof value === "string"))
  return typeof field.index === "number" && validKind && validValue
}

function isSavedPageState(value: unknown): value is SavedPageState {
  if (typeof value !== "object" || value === null) return false
  const state = value as Partial<SavedPageState>
  return (
    typeof state.scrollX === "number" &&
    typeof state.scrollY === "number" &&
    Array.isArray(state.fields) &&
    state.fields.every(isSavedPageField)
  )
}

export async function savePageState(webContents: WebContents): Promise<string> {
  const captured = await webContents.executeJavaScript(CAPTURE_PAGE_STATE_SCRIPT)
  if (!isSavedPageState(captured)) throw new Error("Page state snapshot was invalid")

  const path = join(tmpdir(), `photon-page-state-${randomUUID()}.json`)
  await writeFile(path, JSON.stringify(captured), { encoding: "utf8", mode: 0o600 })
  return path
}

export async function restorePageState(webContents: WebContents, path: string): Promise<void> {
  try {
    const serialized = await readFile(path, "utf8")
    const parsed: unknown = JSON.parse(serialized)
    if (!isSavedPageState(parsed)) return
    await webContents.executeJavaScript(`(${RESTORE_PAGE_STATE_SCRIPT})(${JSON.stringify(parsed)})`)
  } finally {
    await deletePageState(path)
  }
}

export async function deletePageState(path: string): Promise<void> {
  await unlink(path).catch(() => undefined)
}
