# Frontend Visual Debug Checklist

## Reproduction
- Capture issue on desktop/tablet/mobile.
- Record URL, viewport, and interaction steps.

## Layout Integrity
- No horizontal overflow on root layout.
- Panels do not overlap critical interactive zones.
- No clipped text or inaccessible controls.

## 3D + Overlay
- Canvas is visible and sized to container.
- Overlay layers do not block critical pointer events.
- Tooltip/drawer layering is correct.

## Runtime Health
- No unhandled page errors.
- No repeated console errors after initial render.
- Data-loading fallback transitions resolve correctly.
