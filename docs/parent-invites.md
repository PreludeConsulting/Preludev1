# Parent and guardian invitations

Students can invite a parent or guardian during onboarding (`/onboarding/parent`) or later from **Settings → Family**. The flow mirrors the demo parent account linkage: a pending invite row is stored in Supabase, an email is sent with a secure registration link, and the accounts are linked automatically when the parent signs up or logs in with the invited email.

## End-to-end flow

1. **Student enters a parent email** on the invite form.
2. **Supabase RPC** `connect_student_parent_email(student_id, parent_email)`:
   - saves `profiles.parent_guardian_email`
   - upserts `parent_invites` with a unique `invite_token`
   - auto-accepts and inserts `parent_student_links` if a parent account with that email already exists
3. **API** `POST /api/parent-invites/send` emails the parent a link:
   - `https://<PUBLIC_APP_URL>/register?parentInvite=<token>&role=parent`
4. **Parent registers or logs in** with the invited email.
5. **Auth bootstrap** runs `accept_parent_invite` / `accept_all_pending_parent_invites`, creating `parent_student_links` rows (same tables used by `supabase/seed-demo-parent-links.sql`).

## Deployment surfaces

| Runtime | Handler |
|---------|---------|
| Cloudflare Pages (production) | `functions/api/parent-invites/send.js` — passes `context.env` through to email helpers (Workers have no Node `process` global) |
| Vite dev / embedded API | `server/supabaseParentInvitesApi.js` via `createApiStack` |
| Vercel-style `api/` routes | `api/parent-invites/send.js` → `server/supabaseParentInvitesApi.js` |

All three call the shared server helper `server/lib/parentInvites.js`, which:

- authenticates the caller with `Authorization: Bearer <supabase_access_token>`
- verifies the caller is a **student** profile
- delivers email through Resend (`RESEND_API_KEY`, `AUTH_EMAIL_FROM`)

Legacy Prisma/JWT auth is **not** used for this route in production.

## Required Supabase schema

Run in the Supabase SQL editor (or apply migrations):

```bash
# Preferred — tracked migration
supabase/migrations/20260703000000_parent_links.sql
```

Equivalent manual script: `supabase/parent-links.sql` (safe to re-run).

Confirm tables exist:

```sql
select relname from pg_class
where relname in ('parent_invites', 'parent_student_links');
```

## Required environment variables

```env
# Browser
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...

# Server / Cloudflare Functions
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
AUTH_EMAIL_FROM=Prelude <no-reply@your-domain.com>
PUBLIC_APP_URL=https://preludeconsultingllc.com
```

## Key files

| Area | Path |
|------|------|
| Onboarding UI | `src/components/onboarding/ParentInviteOnboardingPage.jsx` |
| Settings UI | `src/dashboard/components/settings/ParentGuardianSettingsPanel.jsx` |
| Client linking | `src/lib/parentLinks.js` |
| Shared errors | `shared/parentInviteErrors.js` |
| API core | `server/lib/parentInvites.js` |
| Node middleware | `server/supabaseParentInvitesApi.js` |
| Cloudflare function | `functions/api/parent-invites/send.js` |
| Demo seed | `supabase/seed-demo-parent-links.sql` |

## Error handling

| Scenario | User-facing behavior |
|----------|---------------------|
| Missing Cloudflare function / API route | Fixed by `functions/api/parent-invites/send.js` |
| Missing Supabase tables/functions | Clear message to run `20260703000000_parent_links.sql` |
| Session expired | “Sign in again and retry the invitation.” |
| Student invites own email | “Enter your parent or guardian's email, not your own.” |
| Resend not configured (production) | 503 email delivery error |
| Parent already has account | Invite auto-accepted; link row marked `accepted` |

## Tests

```bash
npm test -- tests/parentInviteErrors.test.js
node --test tests/server/supabaseParentInvites.node.test.js tests/server/parentInviteEmail.node.test.js
```

## Manual QA

1. Sign in as a student → `/onboarding/parent` or Settings → Family.
2. Enter a valid parent email → expect **Invitation sent** (not “Request failed”).
3. Confirm `parent_invites` row in Supabase with `status = pending`.
4. Parent receives email; link opens `/register?parentInvite=...&role=parent`.
5. Parent completes signup → parent dashboard shows linked student (like demo accounts).
6. Re-invite same email → status remains consistent; no duplicate link errors.
