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
- Future website content uses WebContentsView, never BrowserView or iframes.
- Preload is narrow and typed.
- Renderer never accesses Node directly.
- Tab is not a WebContentsView; browser state and renderer lifecycle stay separate.

## Native view composition

- CSS z-index never controls WebContentsView stacking.
- WindowComposition is the only owner of the BrowserWindow child-view hierarchy.
- TabManager owns page views but does not attach or lay them out directly.
- Permanent browser chrome stays outside webpage bounds.
- UI crossing webpage bounds uses the dedicated PhotonOverlayView.
- Overlay bounds should be as small as practical to avoid blocking website input.
- Websites never receive Photon preload or privileged IPC.
- No direct BrowserWindow child-view manipulation exists outside WindowComposition.

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
