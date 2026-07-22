# Prelude cross-platform motion QA — 2026-07-22

## Root causes

The PreludeMatch cinematic combined a full-scene camera scale with a second wordmark scale, so the final logo changed geometry even after its own animation settled. Its percentage label also used Anime.js `innerHTML` updates on every frame. Several large decorative layers used CSS blur or drop-shadow filters.

The Built for Parents cards ran three perpetual float animations while a separate focus frame measured card and container rectangles, listened for window and element resizes, wrote width and height, and created a Web Animations API transform on every active-card change. Animated box shadows and image filters added paint cost.

The browser suite had an independent reliability bug: `scripts/dev-all.mjs` allowed Vite to bind to IPv6 localhost while Playwright waited on `127.0.0.1`. A stale IPv4 server could therefore be reused and yield blank pages.

## Permanent fixes

- The wordmark now has one fixed scale and position. Reveal and loop exit use opacity only.
- The full-scene camera push was removed, preventing inherited logo zoom.
- The progress label is stable `100%`; the bar alone communicates progress with `scaleX`.
- Cinematic blur filters were replaced with layered radial gradients and opacity.
- Parent cards use one card-local border layer plus transform/opacity emphasis.
- The parent focus frame, bounding-box reads, ResizeObserver, extra RAF owner, perpetual floats, animated shadows, and image filter were removed.
- Existing motion-tier, viewport, and document-visibility gates remain the lifecycle owner for continuous landing effects.
- The integrated dev server explicitly binds to `127.0.0.1`, matching Playwright.

## Automated verification

- Motion-focused Vitest suite: 72 tests passed before the final full-suite run.
- Final full validation: 95 Vitest files / 522 tests passed, 228 Node server tests passed, API route checks passed, ESLint passed with zero warnings, TypeScript passed, and the Vite production build completed successfully.
- Cross-platform browser matrix: 31 passed, 2 mobile-only skips across Chromium, WebKit, and mobile Chromium.
- Isolated motion performance suite (`npm run test:e2e:performance`): 4 passed at 1920×1080, 1440×900, and 1280×800, including zero offscreen mutations. It runs in one Chromium worker so concurrent functional browsers cannot contaminate frame timing.
- ESLint: passed.
- TypeScript: passed.
- Production build: passed during implementation; repeated in the final gate.

The performance test fails if a sampled viewport has an animation long task over 50ms, fewer than 95% of frames within the calibrated display-frame threshold, a p95 frame above that threshold, or any mutation in the offscreen cinematic/parent subtree.

## Browser coverage

- macOS local: native Google Chrome 150 passed `/`, `/plans`, `/mentors`, and `/contact` with zero console errors and zero horizontal overflow; native Safari 26.5 passed the same route/render checks through SafariDriver.
- Chromium/WebKit automation and rendered 1440px/390px visual checks also completed.
- No browser-farm credentials were available, so native Windows Chrome/Edge recording remains pending. No Windows result has been inferred from user-agent emulation.

React Router emits a development-only v7 transition migration warning. Prelude intentionally leaves that flag disabled because the route-lazy-loading regression contract protects dashboard tab navigation from suspension; production behavior and the browser error checks remain clean.

## Changed surfaces

- `src/components/TrueFocus.jsx`
- `src/components/TrueFocus.css`
- `src/components/hero/PreludeMatchCinematicBeats.jsx`
- `src/lib/preludeMatchCinematicMotion.js`
- `src/lib/preludeMatchCinematicRuntime.js`
- `src/index.css`
- `scripts/dev-all.mjs`
- `tests/crossPlatformAnimationContracts.test.js`
- `tests/e2e/motion-performance.spec.js`
