import { WebContentsView, type BrowserWindow, type Rectangle } from "electron"
import { join } from "node:path"
import {
  BROWSER_LAYOUT,
  getBrowserContentBounds,
  type BrowserBounds,
} from "@/shared/browser-layout"
import {
  OVERLAY_HIDDEN_CHANNEL,
  OVERLAY_STATE_CHANNEL,
  type SiteSecurityOverlayState,
} from "@/shared/overlay"
import { PHOTON_THEME_COLORS } from "@/shared/theme-colors"

export type OverlayRequest =
  { kind: "browser"; bounds: Rectangle; state: SiteSecurityOverlayState } | { kind: "perf" }

type FocusTarget = "chrome" | "page"

/**
 * Owns the native children of a Photon BrowserWindow.
 *
 * BrowserWindow's own renderer is the permanent PhotonChromeView. Page views
 * are inserted at index 0 so they remain below that renderer; the reusable
 * overlay is inserted last only while it has visible UI.
 */
export class WindowComposition {
  private readonly browserWindow: BrowserWindow
  private readonly contentView: BrowserWindow["contentView"]
  private readonly overlayPageUrl: string
  private readonly handleWindowResize = (): void => this.updateLayout()
  private overlayView: WebContentsView | undefined
  private activePage: WebContentsView | undefined
  private requestedOverlayBounds: Rectangle | undefined
  private requestedOverlayState: SiteSecurityOverlayState | undefined
  private perfBounds: BrowserBounds | undefined
  private appliedPageBounds: BrowserBounds | undefined
  private appliedOverlayBounds: BrowserBounds | undefined
  private overlayVisible = false
  private overlayReady = false
  private perfOverlayVisible = false
  private perfOverlaySuspended = false
  private focusTarget: FocusTarget = "chrome"
  private focusBeforeOverlay: FocusTarget = "chrome"
  private initialized = false

  constructor(browserWindow: BrowserWindow, overlayPageUrl: string) {
    this.browserWindow = browserWindow
    this.contentView = browserWindow.contentView
    this.overlayPageUrl = overlayPageUrl
    this.browserWindow.on("resize", this.handleWindowResize)
    this.browserWindow.on("maximize", this.handleWindowResize)
    this.browserWindow.on("unmaximize", this.handleWindowResize)
    this.browserWindow.on("enter-full-screen", this.handleWindowResize)
    this.browserWindow.on("leave-full-screen", this.handleWindowResize)
  }

  initialize(): void {
    // Page views must be laid out only after the hidden chrome window has its real content size.
    if (this.initialized) return
    this.initialized = true
    this.updateLayout()
  }

  attachActivePage(page: WebContentsView | undefined): void {
    if (this.activePage === page) {
      this.updateLayout()
      this.ensureZOrder()
      return
    }

    if (this.activePage) this.detachPageView(this.activePage)
    this.activePage = page
    this.appliedPageBounds = undefined
    if (page) {
      page.setVisible(true)
    }
    this.updateLayout()
    this.ensureZOrder()
  }

  detachPage(page: WebContentsView): void {
    if (this.activePage !== page) return
    this.detachPageView(page)
    this.activePage = undefined
    this.ensureZOrder()
  }

  showOverlay(request: OverlayRequest): void {
    const overlayView = this.ensureOverlayView()
    if (!this.overlayVisible) this.focusBeforeOverlay = this.focusTarget
    if (request.kind === "perf") {
      this.perfOverlayVisible = true
    } else {
      if (this.perfOverlayVisible) this.perfOverlaySuspended = true
      this.perfOverlayVisible = false
      this.perfBounds = undefined
      this.requestedOverlayBounds = request.bounds
      this.requestedOverlayState = request.state
    }
    this.overlayVisible = true
    this.contentView.addChildView(overlayView)
    overlayView.setVisible(true)
    this.updateLayout()
    this.ensureZOrder()
    this.sendOverlayState()
  }

  hideOverlay(kind?: OverlayRequest["kind"]): void {
    if (!this.overlayVisible) return
    if (kind === "perf") {
      this.perfOverlayVisible = false
    } else if (kind === "browser") {
      this.requestedOverlayBounds = undefined
      this.requestedOverlayState = undefined
      this.appliedOverlayBounds = undefined
      if (this.perfOverlaySuspended) {
        this.perfOverlayVisible = true
        this.perfOverlaySuspended = false
      }
    } else {
      this.requestedOverlayBounds = undefined
      this.requestedOverlayState = undefined
      this.appliedOverlayBounds = undefined
      this.perfOverlayVisible = false
    }
    if (kind !== "perf") this.sendOverlayHidden()
    if (!this.perfOverlayVisible && !this.requestedOverlayBounds) {
      this.overlayVisible = false
      const overlayView = this.overlayView
      if (overlayView) {
        overlayView.setVisible(false)
        this.contentView.removeChildView(overlayView)
      }
      this.restoreFocus()
    } else {
      this.updateLayout()
      this.ensureZOrder()
    }
  }

  focusChrome(): void {
    if (this.browserWindow.isDestroyed()) return
    this.browserWindow.focus()
    if (this.browserWindow.webContents.isDestroyed()) return
    this.browserWindow.webContents.focus()
    this.focusTarget = "chrome"
  }

  focusPage(page: WebContentsView): void {
    if (this.activePage !== page || page.webContents.isDestroyed()) return
    this.browserWindow.focus()
    page.webContents.focus()
    this.focusTarget = "page"
  }

  focusOverlay(): void {
    const overlayView = this.overlayView
    if (!this.overlayVisible || !overlayView || overlayView.webContents.isDestroyed()) return
    this.browserWindow.focus()
    overlayView.webContents.focus()
  }

  dispose(): void {
    this.browserWindow.off("resize", this.handleWindowResize)
    this.browserWindow.off("maximize", this.handleWindowResize)
    this.browserWindow.off("unmaximize", this.handleWindowResize)
    this.browserWindow.off("enter-full-screen", this.handleWindowResize)
    this.browserWindow.off("leave-full-screen", this.handleWindowResize)
    if (this.activePage) this.detachPageView(this.activePage)
    this.activePage = undefined
    this.appliedPageBounds = undefined
    if (this.overlayView) {
      this.overlayView.setVisible(false)
      this.contentView.removeChildView(this.overlayView)
      this.overlayView.webContents.close()
      this.overlayView = undefined
    }
    this.requestedOverlayBounds = undefined
    this.requestedOverlayState = undefined
    this.appliedOverlayBounds = undefined
    this.perfBounds = undefined
    this.overlayVisible = false
    this.overlayReady = false
    this.perfOverlayVisible = false
    this.perfOverlaySuspended = false
  }

  private updateLayout(): void {
    const [width = 0, height = 0] = this.browserWindow.getContentSize()
    // Desktop window movement does not change child-view coordinates. Keep
    // native layout idempotent even if a platform emits a redundant event.
    const windowSize = {
      width: Math.max(0, Math.round(width)),
      height: Math.max(0, Math.round(height)),
    }
    const contentBounds = getBrowserContentBounds(windowSize)

    if (this.activePage) {
      if (!sameBounds(this.appliedPageBounds, contentBounds)) {
        this.activePage.setBounds(contentBounds)
        this.activePage.setBorderRadius(BROWSER_LAYOUT.contentRadius)
        this.appliedPageBounds = contentBounds
      }
    }
    if (this.overlayVisible && this.overlayView && this.requestedOverlayBounds) {
      const overlayBounds = constrainOverlayBounds(this.requestedOverlayBounds, windowSize)
      if (!sameBounds(this.appliedOverlayBounds, overlayBounds)) {
        this.overlayView.setBounds(overlayBounds)
        this.appliedOverlayBounds = overlayBounds
      }
    }
    if (this.perfOverlayVisible && this.overlayView) {
      const perfBounds = getPerfOverlayBounds(windowSize)
      if (!sameBounds(this.perfBounds, perfBounds)) {
        this.overlayView.setBounds(perfBounds)
        this.perfBounds = perfBounds
      }
    }
  }

  private ensureZOrder(): void {
    if (this.activePage) {
      this.contentView.addChildView(this.activePage, 0)
    }
    if (this.overlayVisible && this.overlayView) this.contentView.addChildView(this.overlayView)
  }

  private ensureOverlayView(): WebContentsView {
    if (this.overlayView) return this.overlayView

    const overlayView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: true,
      },
    })
    overlayView.setBackgroundColor(PHOTON_THEME_COLORS.transparentOverlay)
    overlayView.webContents.on("did-finish-load", () => {
      this.overlayReady = true
      this.sendOverlayState()
    })
    this.overlayView = overlayView
    void overlayView.webContents.loadURL(this.overlayPageUrl).catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.error(
          "Photon overlay failed to load: " +
            (error instanceof Error ? error.message : "Unknown error"),
        )
      }
    })
    return overlayView
  }

  private sendOverlayState(): void {
    if (!this.overlayVisible || !this.overlayReady || !this.requestedOverlayState) return
    const overlayView = this.overlayView
    if (!overlayView || overlayView.webContents.isDestroyed()) return
    overlayView.webContents.send(OVERLAY_STATE_CHANNEL, this.requestedOverlayState)
  }

  private sendOverlayHidden(): void {
    const overlayView = this.overlayView
    if (!this.overlayReady || !overlayView || overlayView.webContents.isDestroyed()) return
    overlayView.webContents.send(OVERLAY_HIDDEN_CHANNEL)
  }

  private detachPageView(page: WebContentsView): void {
    this.contentView.removeChildView(page)
    page.setVisible(false)
    this.appliedPageBounds = undefined
  }

  private restoreFocus(): void {
    if (this.focusBeforeOverlay === "page" && this.activePage) {
      this.focusPage(this.activePage)
      return
    }
    this.focusChrome()
  }
}

function sameBounds(first: BrowserBounds | undefined, second: BrowserBounds): boolean {
  return (
    first?.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  )
}

function constrainOverlayBounds(
  bounds: Rectangle,
  windowSize: { width: number; height: number },
): BrowserBounds {
  const x = Math.min(Math.max(0, Math.round(bounds.x)), windowSize.width)
  const y = Math.min(Math.max(0, Math.round(bounds.y)), windowSize.height)
  return {
    x,
    y,
    width: Math.min(Math.max(0, Math.round(bounds.width)), windowSize.width - x),
    height: Math.min(Math.max(0, Math.round(bounds.height)), windowSize.height - y),
  }
}

function getPerfOverlayBounds(windowSize: { width: number; height: number }): BrowserBounds {
  return {
    x: 8,
    y: windowSize.height - 120,
    width: 200,
    height: 120,
  }
}
