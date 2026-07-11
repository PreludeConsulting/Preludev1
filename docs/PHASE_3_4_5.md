# Phases 3–5 — Data unification, mobile/a11y, performance polish

Implemented after the Phase 1–2 trustworthiness work from the 2026-07-10 QA report.

## Phase 3 — Unify the data

### Single source of truth
- **Coins / redemptions**: Supabase `reward_wallets` + new `reward_redemptions` table. `ProgressRewardsContext` loads wallet, tasks, and redemptions together via `buildRewardsSnapshot()`.
- **Streaks / progress sidebar**: `buildSidebarProgressFromSnapshot()` derives login streak and milestone counts from `reward_task_instances` (no hard-coded demo streak values).
- **Mentor availability**: `mentor_profiles.hourly_availability` JSONB column; `MentorAvailabilityProduct` persists through `saveMentorAvailability()`.
- **Profile**: Supabase users no longer merge stale `profileOverrides` from localStorage on refresh (avatar preview only).

### Removed silent fallbacks
- Supabase rewards skip `prelude-progress-rewards-*` localStorage init and persistence.
- Non-Supabase `/api/dashboard/app-data` failures surface `dashboardSyncState: failed` instead of silently pretending data synced.
- `StudentGamificationShell` starts Supabase users at zero coins until the wallet loads.

### Sync states
- `DataSyncBanner` shows loading / saved / failed for dashboard and rewards.
- `createSyncState()` in `src/dashboard/lib/dataSyncState.js`.

### Migration
Run `supabase/migrations/20260711000000_phase3_data_unification.sql` (reward redemptions + hourly availability).

## Phase 4 — Mobile and accessibility

- **Notification popover**: Portaled via `PopoverPortal` with viewport-aware fixed positioning.
- **Mobile nav**: Horizontal tab scroller keeps scroll affordance (“Swipe” hint + edge mask).
- **Modal focus**: Shared `bindFocusTrap()` in `src/lib/focusTrap.js`; dashboard `Modal` uses inert background + scroll lock.
- **Site search**: Combobox keyboard nav, return focus to trigger, stable `aria-controls` listbox, `aria-modal` dialog semantics.

## Phase 5 — Performance and polish

- **Colleges**: Paginated results (20 per page) with sticky filter bar and result range label.
- **Mentor photo**: Maya Patel demo headshot uses `object-position: 50% 22%`.
- **Calendar pills**: Full title + time in tooltip/`aria-label`.
- **Translations**: Added `nav.searchHint` and `nav.searchResultsLabel` (EN + ES).
- **Mentors reviews**: Previous/next controls with position indicator (replaces auto-marquee-only UX).
- **Console**: React Router v7 `future` flags enabled in `main.jsx`.

## Tests

```bash
npm test
```

New coverage:
- `tests/rewardsSnapshot.test.js`
- `tests/dataSyncState.test.js`
- `tests/focusTrap.test.js`

## Key files

| Area | Files |
|------|-------|
| Rewards snapshot | `src/dashboard/lib/rewardsSnapshot.js`, `src/dashboard/context/ProgressRewardsContext.jsx` |
| Sync states | `src/dashboard/lib/dataSyncState.js`, `src/dashboard/components/DataSyncBanner.jsx` |
| Availability | `src/lib/dashboardData.js`, `src/dashboard/components/product/MentorAvailabilityProduct.jsx` |
| Focus / popovers | `src/lib/focusTrap.js`, `src/components/ui/PopoverPortal.jsx` |
| Colleges pagination | `src/dashboard/components/product/CollegesExplore.jsx` |
