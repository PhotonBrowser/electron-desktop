# Photon Browser

Photon is a custom browser built with Electron.

## Priorities

1. Correctness
2. Simplicity
3. Performance
4. Maintainability
5. Polish

## Architecture

- Electron main owns browser mechanics and lifecycle.
- React owns browser chrome.
- Arbitrary websites are untrusted.
- Current website content uses DOM `<webview>` guests. Future website-content
  migrations may use WebContentsView, never BrowserView or iframes, and must be
  planned explicitly.
- Preload is narrow and typed.
- Renderer never accesses Node directly.
- A tab is browser state, not a WebContentsView or DOM handle. Browser state and
  renderer/native lifecycle stay separate.

## Native view composition

- CSS z-index never controls WebContentsView stacking.
- WindowComposition is the only owner of the BrowserWindow child-view hierarchy.
- TabManager owns tab state and lifecycle callbacks; it does not attach or lay
  out native page views directly.
- Permanent browser chrome stays outside webpage bounds.
- Current overlays stay inside the chrome renderer. Any future UI that must
  cross a native webpage boundary needs an explicitly owned native overlay view.
- Overlay bounds should be as small as practical to avoid blocking website input.
- Websites never receive Photon preload or privileged IPC.
- No direct BrowserWindow child-view manipulation exists outside WindowComposition.

## Current implementation map

- `src/main/index.ts` wires the app lifecycle and one browser window.
- `src/main/browser/` owns tab state, navigation resolution, internal pages,
  downloads, and memory-saver lifecycle.
- `src/main/ipc/browser-ipc.ts` owns renderer IPC handlers. Channel names live
  in `src/shared/ipc-channels.ts`; payloads are validated at the boundary.
- `src/main/window/window-composition.ts` is the only owner of the
  BrowserWindow child-view hierarchy and chrome bounds.
- `src/main/window/browser-shortcuts.ts` owns main-process shortcut routing.
- `src/main/sessions/browser-session.ts` owns guest security and new-window
  routing. Allowed HTTP(S) popup requests become Photon tabs; all other popup
  requests are denied.
- `src/main/views/chrome-view.ts` creates the privileged chrome renderer with
  `contextIsolation`, `sandbox`, `nodeIntegration: false`, and `webviewTag`.
- `src/preload/` exposes the narrow typed `window.photon` API and no Node API.
- `src/shared/` contains domain types, IPC channels, browser constants, theme
  colors/settings, webview event names, site-security helpers, and logging.
- `src/renderer/src/app/` composes the chrome and owns app-level synchronization
  hooks.
- `src/renderer/src/features/` groups browser, tabs, navigation, omnibox, and
  menu components/hooks by feature.
- `src/renderer/src/features/browser/components/BrowserView.tsx` is the only
  component that renders the DOM `<webview>` boundary. Its event lifecycle is
  in `useWebviewEvents`.
- `src/renderer/src/stores/` owns the small Zustand browser store. The store
  contains serializable tab/settings state only; it never stores DOM or
  WebContents handles.
- `src/renderer/src/index.css` owns Photon visual tokens and the clipping
  boundary around webpage guests.

## Refactoring baseline

- `App`, `BrowserView`, `TabStrip`, toolbar controls, menus, and navigation
  controls are composed from focused modules rather than one browser component.
- Meaningful lifecycle behavior is kept in focused hooks such as
  `useBrowserSync`, `useMemorySaverSync`, `usePhotonTheme`, `useActiveTab`,
  `useTabReordering`, and `useWebviewEvents`.
- Derived active-tab access uses narrow selectors/hooks. Components should not
  subscribe to the entire Zustand store.
- Browser actions cross the typed preload boundary and are handled in main;
  components must not reach into Electron internals directly.
- Zustand's built-in `persist` middleware is used for persisted browser
  preferences. Do not add custom persistence or another state library without
  a concrete need.
- Native platform APIs and modern JavaScript are preferred over utility
  dependencies. Do not add hotkey, URL, schema, immutable-update, or event
  libraries unless they replace meaningful existing complexity.
- Obsolete OSR, frame-capture, canvas transport, native-bounds-sync, and old
  session/IPC paths must not be reintroduced. Remove only code confirmed to be
  unused.

## Stabilization baseline

- Browser-global shortcuts are registered once against chrome and each guest
  web contents as it attaches. The registration deduplicates guests and always
  removes both guest and chrome listeners during cleanup. Destroyed guests are
  removed from the tracking set immediately.
- Shortcut matching uses exact modifier sets. Browser commands include
  `Ctrl/Cmd+L`, tab creation/closing/reopening, reload, tab cycling,
  `Alt+Left/Right`, and development tools. `Ctrl/Cmd+F` remains a normal page
  shortcut until a find feature is explicitly planned.
- `BrowserView` is keyed by stable `tab.id` and memoized against unchanged tab
  records. Inactive webviews remain mounted and hidden; only the explicit
  memory-saver frozen state unmounts them.
- `BrowserView` pins the initial `src` to the guest's mount. Existing web tabs
  navigate through the typed main-to-renderer command channel, so URL updates
  never reset `src` or recreate a guest. Popup opt-in is set before `src` so
  Electron can deliver `setWindowOpenHandler` requests to the main process.
- `useWebviewEvents` owns the complete DOM webview listener lifecycle. Every
  event listener and preload subscription has a matching cleanup, and
  `useBrowserSync` batches updates with `requestAnimationFrame` while cancelling
  pending work on disposal.
- Keep DOM/WebContents handles out of browser state. The current DOM webview
  ref is local to `BrowserView`; do not add a registry or serializable handle
  field unless the lifecycle requires one.
- Dropdown primitives own their trigger button. Pass trigger content into the
  primitive rather than nesting a reusable button inside another button.
- Renderer store reducer logic lives in `browser-store-state.ts`; persistence
  is limited to validated browser preferences and tab snapshots remain main-
  process authoritative.
- `TabManager` is authoritative for active tab identity, tab order, lifecycle,
  closed-tab URL/title reopening, and browser navigation commands. Chromium
  remains authoritative for webview history; navigation events synchronize URL,
  title, favicon, loading, crash/error, and back/forward state back to the tab.

## Webview and window-corner rules

- Keep webpage rendering in the existing DOM `<webview>` architecture unless a
  separate milestone explicitly changes it.
- Keep each mounted web tab keyed by stable `tab.id`; hiding an inactive tab
  must not recreate or reload its guest. Unmounting is reserved for an explicit
  frozen/memory-saver state.
- Register webview listeners in `useWebviewEvents`, remove every listener in
  its cleanup, and make the effect safe under React StrictMode.
- Keep Electron webview event names in `WEBVIEW_EVENTS`; do not scatter event
  string literals through components.
- `WebContentsView` chrome is a native surface. CSS z-index cannot order it
  against other native views.
- The `BaseWindow` uses Electron's `roundedCorners: true` option where the
  platform supports it. The renderer also uses the existing window and inner
  page radius tokens.
- The page surface and `<webview>` must retain the explicit rounded
  `clip-path`/overflow boundary. A guest surface can otherwise show a sharp
  corner through a rounded DOM parent.
- Do not introduce the experimental `BaseWindow.setShape()` as a generic
  fallback without validating launch, resize, maximize, fullscreen, and input
  behavior on every target platform.

## Code

- Keep modules focused and preferably at or below 300 lines.
- Split code into modules by actual responsibility when a file grows; do not
  create speculative layers.
- No generic utility dumping grounds or speculative abstractions.
- No unused dependencies, stringly typed IPC, or any unless unavoidable.
- No ignored lint or type errors.
- Dispose listeners cleanly; use events instead of polling.
- Avoid blocking synchronous work in main and renderer.
- Use narrow Zustand selectors and avoid unnecessary rerenders.

## Imports

- Use `@/` for modules under `src/`.
- Use `@resources/` for assets under `resources/`.
- Keep relative imports for nearby modules; replace deep `../../../` imports with
  an alias.

## Validation

Before handing off a change, run the relevant checks. The full baseline is:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm check` for the combined typecheck, lint, format, and build check

For browser-facing changes, also smoke-test app launch, new-tab rendering,
webpage navigation, tab switching, back/forward, reload, menus, shortcuts,
window controls, resizing, and preservation of mounted webviews.

Focused logic tests belong beside the relevant module and should cover pure URL
resolution, tab operations, navigation state, IPC validation, selectors/actions,
shortcut mappings, and other extracted browser utilities. Avoid tests coupled
to incidental component markup.

## Completed baseline checks

The current refactoring baseline has passed typecheck, lint, format checking,
build, and the focused test suite. The test suite currently covers URL/search
resolution, tab operations and lifecycle, IPC validation/update coalescing,
shortcut mappings, internal pages, downloads, and site-security helpers.

## Agent Workflow

- Use the correct local skills for the task, including Caveman and Ponytail.
- Prefer simple implementations, native platform APIs, and existing dependencies.
- Do not implement features outside the current milestone.

## UI

- Minimalist, neutral, compact.
- No purple, amber, excessive gradients, or blur-heavy UI.
- Animate with transform and opacity.
- Never use permanent will-change.

Do not implement features outside current milestone.
