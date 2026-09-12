import {
  Menu,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents,
} from "electron"

export function showBrowserContextMenu(webContents: WebContents, params: ContextMenuParams): void {
  const saveItem = getSaveItem(webContents, params)
  const template = [
    {
      label: "Back",
      enabled: webContents.canGoBack(),
      click: () => webContents.goBack(),
    },
    {
      label: "Reload",
      click: () => webContents.reload(),
    },
    ...(params.selectionText
      ? [
          { type: "separator" as const },
          {
            label: "Copy",
            click: () => webContents.copy(),
          },
        ]
      : []),
    ...(saveItem ? [saveItem] : []),
    { type: "separator" as const },
    {
      label: "Print",
      click: () => webContents.print(),
    },
    ...(isWebUrl(params.pageURL)
      ? [
          { type: "separator" as const },
          {
            label: "View page source",
            click: () => void webContents.loadURL(`view-source:${params.pageURL}`),
          },
        ]
      : []),
    {
      label: "Inspect",
      click: () => webContents.openDevTools({ mode: "detach" }),
    },
  ]

  const popupOptions = {
    x: params.x,
    y: params.y,
    ...(params.frame ? { frame: params.frame } : {}),
  }
  Menu.buildFromTemplate(template).popup(popupOptions)
}

function getSaveItem(
  webContents: WebContents,
  params: ContextMenuParams,
): MenuItemConstructorOptions | undefined {
  if (params.linkURL && isWebUrl(params.linkURL)) {
    return {
      label: "Save link as…",
      click: () => webContents.downloadURL(params.linkURL),
    }
  }

  if (params.srcURL && isWebUrl(params.srcURL)) {
    return {
      label: "Save image as…",
      click: () => webContents.downloadURL(params.srcURL),
    }
  }

  return undefined
}

function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
