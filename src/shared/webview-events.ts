export const WEBVIEW_EVENTS = {
  didAttach: "did-attach-webview",
  didFailLoad: "did-fail-load",
  didNavigate: "did-navigate",
  didNavigateInPage: "did-navigate-in-page",
  didStartLoading: "did-start-loading",
  didStopLoading: "did-stop-loading",
  domReady: "dom-ready",
  pageFaviconUpdated: "page-favicon-updated",
  pageTitleUpdated: "page-title-updated",
  renderProcessGone: "render-process-gone",
  willAttach: "will-attach-webview",
  willNavigate: "will-navigate",
} as const
