export interface BrowserLayout {
  titlebarHeight: number
  toolbarHeight: number
  chromeHeight: number
  contentInset: number
  contentRadius: number
}

export interface BrowserWindowSize {
  width: number
  height: number
}

export interface BrowserBounds {
  x: number
  y: number
  width: number
  height: number
}

const titlebarHeight = 36
const toolbarHeight = 36

export const BROWSER_LAYOUT: BrowserLayout = {
  titlebarHeight,
  toolbarHeight,
  chromeHeight: titlebarHeight + toolbarHeight,
  contentInset: 4,
  contentRadius: 4,
}

export function getBrowserContentBounds(
  windowSize: BrowserWindowSize,
  layout: BrowserLayout = BROWSER_LAYOUT,
): BrowserBounds {
  const width = Math.max(0, windowSize.width - layout.contentInset * 2)
  const height = Math.max(0, windowSize.height - layout.chromeHeight - layout.contentInset * 2)

  return {
    x: layout.contentInset,
    y: layout.chromeHeight + layout.contentInset,
    width,
    height,
  }
}
