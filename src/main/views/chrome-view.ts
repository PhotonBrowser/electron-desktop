import { WebContentsView } from "electron"
import { join } from "node:path"

export function createChromeView(): WebContentsView {
  return new WebContentsView({
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
}

export function loadChromeView(view: WebContentsView, url: string): void {
  void view.webContents.loadURL(url).catch((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "Photon chrome failed to load: " +
          (error instanceof Error ? error.message : "Unknown error"),
      )
    }
  })
}
