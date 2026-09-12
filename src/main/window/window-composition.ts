import type { BaseWindow, WebContentsView } from "electron"

/**
 * Owns the single native child of the browser window: the persistent chrome
 * renderer. Webpage guests are DOM webviews inside that renderer and do not
 * participate in this native hierarchy.
 */
export class WindowComposition {
  private readonly browserWindow: BaseWindow
  private readonly chromeView: WebContentsView
  private readonly handleWindowResize = (): void => this.updateChromeBounds()
  private initialized = false
  private disposed = false

  constructor(browserWindow: BaseWindow, chromeView: WebContentsView) {
    this.browserWindow = browserWindow
    this.chromeView = chromeView
    this.browserWindow.contentView.addChildView(chromeView)
    this.browserWindow.on("resize", this.handleWindowResize)
    this.browserWindow.on("maximize", this.handleWindowResize)
    this.browserWindow.on("unmaximize", this.handleWindowResize)
    this.browserWindow.on("enter-full-screen", this.handleWindowResize)
    this.browserWindow.on("leave-full-screen", this.handleWindowResize)
  }

  initialize(): void {
    if (this.initialized) return
    this.initialized = true
    this.updateChromeBounds()
  }

  focusChrome(): void {
    if (this.browserWindow.isDestroyed() || this.chromeView.webContents.isDestroyed()) return
    this.browserWindow.focus()
    this.chromeView.webContents.focus()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.browserWindow.off("resize", this.handleWindowResize)
    this.browserWindow.off("maximize", this.handleWindowResize)
    this.browserWindow.off("unmaximize", this.handleWindowResize)
    this.browserWindow.off("enter-full-screen", this.handleWindowResize)
    this.browserWindow.off("leave-full-screen", this.handleWindowResize)
    if (!this.browserWindow.isDestroyed()) {
      this.browserWindow.contentView.removeChildView(this.chromeView)
    }
    if (!this.chromeView.webContents.isDestroyed()) this.chromeView.webContents.close()
  }

  private updateChromeBounds(): void {
    if (this.browserWindow.isDestroyed()) return
    const [width = 0, height = 0] = this.browserWindow.getContentSize()
    this.chromeView.setBounds({
      x: 0,
      y: 0,
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
    })
  }
}
