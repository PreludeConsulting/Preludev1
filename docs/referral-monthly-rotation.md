# Monthly referral-code rotation

## Architecture summary

- **Stable referral owner:** `households` / `household_id` (shared by linked student + parent).
- **Rotating lookup:** `referral_codes` rows keyed by `(household_id, valid_month)`.
- **Attribution:** `referrals.referrer_household_id` and `referral_rewards.household_id` never change when the visible code rotates.
- **Timezone:** `America/New_York` (product ET). Month boundaries and the cron schedule use this zone.

## Schema (after `20260718000000_monthly_referral_code_rotation.sql`)

| Table / column | Role |
| --- | --- |
| `referral_codes.household_id` | Stable owner FK |
| `referral_codes.valid_month` | First day of calendar month (date) |
| `referral_codes.status` | `active` \| `retired` \| `disabled` |
| `referral_codes.activated_at` / `expires_at` / `replaced_at` | Lifecycle timestamps |
| Unique `(household_id, valid_month)` | One generated code per household per month |
| Partial unique `(household_id) WHERE status = 'active'` | One live code at a time |
| Unique `normalized_code` | Global uniqueness |
| `referral_code_rotation_events` | Household-level notification idempotency |
| `referral_code_rotation_runs` | Batch observability |
| Notification unique on `(user_id, action_type, idempotencyKey)` for `referral_code_rotated` | Per-user notify-once |

## Scheduling

- **Vercel Cron:** `5 5 1 * *` → `POST /api/cron/rotate-referral-codes` (05:05 UTC on the 1st ≈ evening of the 1st in ET / start of day coverage).
- **Auth:** `Authorization: Bearer $CRON_SECRET` (min 16 chars) or `x-cron-secret`.
- **Admin / manual:** `npm run referral:rotate -- --month 2026-08` or `POST /api/admin/referral/rotate-codes`.
- **Cloudflare:** `functions/api/cron/rotate-referral-codes.js` (same secret).

Jobs are **idempotent**: re-running the same month skips households that already have that month’s code and does not duplicate notifications.

## Previous codes

- Retired codes remain in `referral_codes` for audit.
- New submissions require `status = 'active'` only.
- In-flight referrals already store `referrer_household_id` + `referral_code_id`; confirmation/rewards use the household FK.

## Deploy steps

1. Apply Supabase migration `20260718000000_monthly_referral_code_rotation.sql`.
2. Set `CRON_SECRET` in Vercel / Cloudflare / `.env`.
3. Confirm Vercel cron is enabled for the project.
4. Optionally run `npm run referral:rotate` once after deploy to backfill any missing current-month codes.

## Staging checklist

- [ ] Linked student + parent Settings → Profile show the **same** code.
- [ ] After rotation (or CLI `--month`), both see the **new** code; Notifications tab shows one update each (shared household event).
- [ ] Signup with **old** code is rejected; signup with **new** code attributes to the same household.
- [ ] Pending referral confirmed **after** rotation still creates reward on the original household.
- [ ] Re-run rotation for same month: no duplicate codes / notifications.
- [ ] Reward claim CTA and billing behavior unchanged.
