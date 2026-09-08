import { Menu, type BrowserWindow } from "electron"
import type { TabManager } from "../browser/tab-manager"

interface BrowserShortcutsContext {
  browserWindow: BrowserWindow
  tabManager: TabManager
  focusOmnibox: () => void
}

export function registerBrowserShortcuts(context: BrowserShortcutsContext): () => void {
  const { browserWindow, tabManager, focusOmnibox } = context
  const menu = Menu.buildFromTemplate([
    {
      label: "Photon",
      submenu: [
        { label: "Focus Address", accelerator: "CommandOrControl+L", click: focusOmnibox },
        {
          label: "New Tab",
          accelerator: "CommandOrControl+T",
          click: () => tabManager.createTab(),
        },
        {
          label: "Close Tab",
          accelerator: "CommandOrControl+W",
          click: () => tabManager.closeActiveTab(),
        },
        { label: "Reload", accelerator: "CommandOrControl+R", click: () => tabManager.reload() },
        {
          label: "Next Tab",
          accelerator: "CommandOrControl+Tab",
          click: () => tabManager.selectRelativeTab(1),
        },
        {
          label: "Previous Tab",
          accelerator: "CommandOrControl+Shift+Tab",
          click: () => tabManager.selectRelativeTab(-1),
        },
        { label: "Back", accelerator: "Alt+Left", click: () => tabManager.back() },
        { label: "Forward", accelerator: "Alt+Right", click: () => tabManager.forward() },
      ],
    },
  ])

  if (process.platform === "darwin") Menu.setApplicationMenu(menu)
  else {
    browserWindow.setMenu(menu)
    browserWindow.setMenuBarVisibility(false)
  }

  return () => {
    if (process.platform === "darwin") Menu.setApplicationMenu(null)
    else browserWindow.setMenu(null)
  }
}
