# Authentication, authorization, and account management

Prelude now uses a free, self-hosted authentication stack: Vite middleware/Node API handlers, Prisma ORM, PostgreSQL, Argon2id password hashing, JWT access tokens, hashed refresh tokens, HTTP-only cookies, SameSite CSRF defense, and Zod validation. No paid third-party identity, email, or SMS provider is required to run locally or during early startup validation.

## API surface

### Public authentication routes

- `POST /api/auth/register` validates first name, last name, email, password, role, and terms acceptance; hashes the password with Argon2id; creates the role profile; writes an audit log; and creates a hashed, expiring email verification token.
- `GET /api/auth/verify-email?token=...` hashes the presented token, verifies it is active and unexpired, marks it used, and flips `email_verified` on the account.
- `POST /api/auth/login` rate-limits by IP, verifies Argon2id credentials, blocks unverified email accounts, locks the account after repeated failures, creates a server session, stores a hashed refresh token, and returns only safe user fields.
- `POST /api/auth/refresh` rotates refresh tokens, revokes the old token, and issues a new JWT access cookie.
- `POST /api/auth/logout` revokes the current refresh token/session and clears cookies.
- `POST /api/auth/request-reset` always returns a generic response, creates a hashed reset token only when the account exists, and logs the dev reset URL locally.
- `POST /api/auth/reset-password` validates password complexity, consumes a single-use reset token, updates the Argon2id hash, and revokes all sessions for the user.

### Protected account and data routes

- `GET /api/auth/me` reads the authenticated user from the signed access token and active server session.
- `GET/PATCH /api/account/profile` returns or updates only the authenticated user's profile.
- `GET /api/account/sessions` lists only the authenticated user's sessions.
- `DELETE /api/account/sessions/:id` revokes only a session owned by the authenticated user.
- `GET /api/dashboard` returns a role-specific dashboard after server-side RBAC.
- `GET /api/students/:studentProfileId` never trusts the URL alone; it checks the caller's role and database relationships before returning student data.

## Server-side authorization rules

Every protected read follows this pattern:

1. Verify the JWT signature, issuer, audience, expiry, and session ID.
2. Look up the session in PostgreSQL and require `ACTIVE` plus unexpired.
3. Require the user to be active and email-verified.
4. For student-scoped objects, query database ownership/assignment/organization relationships:
   - Students: `student_profiles.user_id = authenticated_user.id`.
   - Mentors: active `mentor_assignments` joins their mentor profile to the requested student profile.
   - Counselors: requested student profile belongs to their organization.
   - Admins: bypass scoped restrictions.
5. Return `403` when a relationship does not exist.

URLs, UUIDs, route params, and frontend state are never sufficient authorization evidence.

## Session and cookie security

- Access token cookie: `prelude_access`, HTTP-only, SameSite `Strict`, secure in production, 15-minute lifetime.
- Refresh token cookie: `prelude_refresh`, HTTP-only, SameSite `Strict`, secure in production, 30-day lifetime.
- CSRF cookie: `prelude_csrf`, SameSite `Strict`, readable by the frontend only so it can be echoed as `X-CSRF-Token` on mutating requests.
- Refresh token rotation stores only SHA-256 token hashes and marks old refresh tokens `USED`.
- Sessions store device, browser, IP address, user agent, timestamps, expiry, and revocation state.
- Users can revoke sessions from `/settings`.

## Rate limiting and account lockout

The API persists rate-limit counters in `rate_limit_buckets`, allowing limits to survive process restarts and work across horizontally scaled instances sharing PostgreSQL. Login, registration, and reset endpoints are rate-limited. Login additionally increments `failed_login_count` and sets `locked_until` after repeated invalid passwords.

## Email delivery without personal funds

During local and early production testing, verification and reset links are logged to the server console. This preserves secure token generation, hashing, expiry, and single-use behavior without requiring a paid provider. A free-tier or paid transactional email provider can later be wired into `sendDevEmail` without schema changes.

## XSS and injection posture

- Prisma parameterizes queries to avoid SQL injection.
- Zod validates request bodies before database writes.
- React escapes rendered text by default; the new account pages do not use dangerous HTML injection.
- Sensitive values such as password hashes, raw reset tokens, raw verification tokens, raw refresh tokens, and JWT secrets are never returned in JSON responses.

## Required environment variables

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
JWT_ACCESS_SECRET="replace-with-a-long-random-secret"
PUBLIC_APP_URL="http://localhost:5173"
NODE_ENV="development"
```

Use a strong `JWT_ACCESS_SECRET` before any public deployment. Run `npx prisma migrate deploy` after Prisma engines are available in the deployment environment.
