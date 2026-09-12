# Photon overlay components

`DropDown` is the shared menu wrapper used by browser chrome. HeroUI owns its
portal placement, focus management, Escape handling, and outside dismissal.

Feature-specific overlays should use HeroUI directly when they need different
semantics, as the site-security popover and settings controls do.

The renderer z-index scale is intentionally limited to these Tailwind tiers:

- `z-10`: base interactive chrome
- `z-20`: suggestions and autocomplete
- `z-30`: floating tools inside a panel
- `z-40`: sheets and non-modal notifications
- `z-50`: modal, popover, and dropdown surfaces

These overlays share the chrome renderer with the page-area webviews, so the
browser overlay layer uses normal DOM stacking and keeps its interactive
children above the guest surface.
