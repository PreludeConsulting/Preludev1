# Prelude admissions database schema

The Prisma schema in `prisma/schema.prisma` and SQL migration in `prisma/migrations/20260601000000_init/migration.sql` define the PostgreSQL backing store for the admissions mentoring platform.

## Core tables

- `users`: UUID identity, names, email, Argon2 password hash, role, status, verification, lockout, and timestamps.
- `sessions`: server-side session state with hashed session secret, device, browser, IP, user agent, expiry, and revocation.
- `refresh_tokens`: hashed refresh tokens with rotation status and replacement tracking.
- `password_reset_tokens` and `email_verification_tokens`: hashed, expiring, single-use account recovery and verification tokens.
- `login_history`, `security_events`, `activity_logs`, and `rate_limit_buckets`: auditability, throttling, and incident response.
- `organizations`, `student_profiles`, `mentor_profiles`, `counselor_profiles`, and `mentor_assignments`: role-specific admissions relationships used by backend authorization.
- `notifications`, `messages`, `college_applications`, and `essays`: protected user data exposed through role-specific dashboards.

## Authorization-critical relationships

- Students own exactly one `student_profiles` record through `student_profiles.user_id`.
- Mentors access students only through active rows in `mentor_assignments` joined through their `mentor_profiles.user_id`.
- Counselors access students only when `student_profiles.organization_id` matches their `counselor_profiles.organization_id`.
- Admins can access all records through backend RBAC checks.

## Scaling notes

All primary keys are UUIDs, high-volume history tables are indexed by user/route/event and timestamp, and JSONB is limited to flexible settings/progress/metadata fields. The schema is designed to work on standard PostgreSQL without paid extensions or managed add-ons.
