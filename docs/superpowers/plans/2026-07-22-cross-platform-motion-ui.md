# Cross-platform motion and UI polish implementation plan

## Goal

Make Prelude's landing motion predictable on Chromium/WebKit and constrained devices without changing its visual hierarchy or product behavior.

## Implementation

- [x] Preserve the shared `full`, `lite`, and `reduced` motion policy and document-visibility lifecycle.
- [x] Treat the PreludeMatch landing cinematic as the advertisement experience.
- [x] Keep the Prelude wordmark at fixed geometry and animate only its opacity.
- [x] Remove cinematic camera zoom, animated blur layers, and per-frame percentage text writes.
- [x] Replace the parent-card measurement/RAF/ResizeObserver focus frame with card-local transform and opacity emphasis.
- [x] Remove perpetual parent-card floats, animated shadows, and image filters.
- [x] Add source contracts for the performance-sensitive implementation.
- [x] Add an isolated, single-worker Chromium frame-budget and offscreen-mutation gate at 1920px, 1440px, and 1280px widths.
- [x] Repair the integrated test server's IPv4 binding so browser QA starts reliably.
- [x] Verify public routes, plan labels, clean landing URLs, and mobile overflow in Chromium and WebKit.
- [x] Run lint, type checking, unit/server/API tests, browser tests, and a production build.

## Acceptance criteria

- No animation long tasks over 50ms in the instrumented Chromium runs.
- At least 95% of sampled active frames at or below 17.5ms, allowing sub-millisecond timer quantization around the 16.7ms display interval.
- Zero observed mutations in the offscreen cinematic and parent-card subtrees.
- Stable Prelude logo geometry through reveal, hold, and loop fade.
- No layout-measurement loop or permanent compositor hint in `TrueFocus`.
- Native Windows verification is reported as pending unless an authenticated browser farm is available.
