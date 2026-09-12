import { WebContentsView } from "electron"
import { join } from "node:path"
import { logger } from "../../shared/logger"

export function createChromeView(): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  view.setBackgroundColor("#00000000")
  return view
}

export function loadChromeView(view: WebContentsView, url: string): void {
  void view.webContents.loadURL(url).catch((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      logger.error(
        "Photon chrome failed to load: " +
          (error instanceof Error ? error.message : "Unknown error"),
      )
    }
  })
}
