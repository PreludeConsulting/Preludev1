# Prelude

Prelude is a college-admissions guidance application that combines a polished marketing site, student and mentor dashboards, PreludeMatch onboarding, and a server-side AI assistant backed by public education datasets. It is built to help students organize the admissions process, mentors manage assigned students, and families make decisions using official data rather than scattered spreadsheets, generic chatbots, or paid third-party identity tools.

## What problems Prelude solves

- **Admissions information is fragmented.** Prelude brings college search, program exploration, career exploration, essay work, deadlines, scholarships, meetings, messaging, and mentor guidance into one application workspace.
- **Students need guidance that is specific but safe.** Prelude AI uses retrieval over public datasets and a controlled knowledge base so answers can include relevant school, program, cost, and admissions context without sending the entire database to the model.
- **Mentors need operational tooling.** Mentor dashboards show assigned students, meetings, priorities, private notes, progress, availability, and messages so coaching work is trackable.
- **Early-stage products need affordable infrastructure.** The auth stack, local development database, dataset pipeline, and optional local AI provider avoid mandatory paid identity, email, SMS, or AI dependencies during development.
- **Families need clear plan boundaries.** All plans use the same Prelude AI; plan differences are roadmap tools, mentor access, sessions, and billing state rather than hidden AI tiers.

## Technology stack

| Layer | Languages / tools | What it does | Problem it fixes |
|---|---|---|---|
| Frontend | JavaScript, React 18, Vite, React Router, CSS, Tailwind/PostCSS utilities | Renders the marketing site, PreludeMatch, auth modals, dashboards, chat UI, and reusable components. | Delivers a fast single-page application with consistent UI and client-side navigation. |
| Dashboard UI | JavaScript, React, FullCalendar, lucide-react, motion | Provides role-specific student and mentor workspaces with calendars, meetings, gamification, and messages. | Replaces disconnected calendar, task, and coaching notes workflows. |
| API layer | Node.js ES modules, Vite middleware, Vercel serverless handlers | Serves `/api/*` routes locally through Vite or separately through a standalone Node server. | Lets the same app run in local single-port development, split frontend/backend development, and serverless deployment. |
| Database | PostgreSQL, Prisma ORM, Prisma migrations | Stores users, sessions, role profiles, mentor assignments, questionnaires, messages, essays, applications, billing metadata, and audit/rate-limit data. | Provides durable account, authorization, dashboard, and compliance-ready state. |
| Public datasets | Python, Bash, SQLite, College Scorecard, O\*NET, NCES CCD | Downloads/prepares education and labor-market data, then serves searchable colleges, programs, careers, and high schools. | Grounds admissions exploration in public data instead of manually curated lists only. |
| AI providers | OpenAI API, Ollama API, server-side configuration | Powers Prelude AI with OpenAI in production or local Ollama models in development. | Keeps API keys off the client and allows low-cost local experimentation. |
| Authentication | Argon2id, JWT, HTTP-only cookies, CSRF tokens, Zod validation | Registers, verifies, logs in, refreshes, logs out, resets passwords, protects accounts, and enforces sessions. | Avoids paid identity providers while still supporting secure password auth and role-aware access. |
| Billing | Stripe API, signed webhooks, local disabled mode | Creates checkout sessions, customer portal sessions, and subscription sync for Plus/Pro plans. | Supports monetization while allowing development to continue when Stripe is not configured. |
| Testing | Vitest, Node test runner, API smoke scripts | Checks frontend logic, dataset behavior, RAG answers, chat safety, provider configuration, and API routes. | Catches regressions across the admissions assistant and backend route surface. |

## Features created

### 1. Marketing and landing experience

The landing page includes a responsive navigation bar, hero section, university carousel, admissions cost banner, mentor network section, plan cards, feature explanations, calls to action, footer, account controls, language switcher, and persistent Prelude AI chat entry point.

**Languages, APIs, and tools**

- React components for page composition.
- React Router for dashboard and account navigation.
- JavaScript data modules for navigation, universities, plan copy, and demo content.
- CSS/Tailwind/PostCSS styling for responsive sections and visual polish.

**Problem fixed**

Families can understand Prelude's value, compare plans, start onboarding, open the dashboard, search the site, or ask Prelude AI without jumping between separate pages or tools.

### 2. Prelude AI chat assistant

Prelude AI is available from the public site and dashboards. It can answer college-admissions questions, use conversation history, identify admissions intents, retrieve relevant context, compare colleges, suggest next steps, and fall back to safe static guidance when a model or dataset service is unavailable.

**Languages, APIs, and tools**

- Node.js `/api/chat` endpoint.
- OpenAI Chat Completions-compatible flow through server-side configuration.
- Ollama local model support for development.
- Retrieval-Augmented Generation (RAG) modules for intent detection, context retrieval, prompt building, conversation state, corrections, comparisons, fallback guidance, and response quality checks.
- Markdown formatting and chat-link security helpers.

**Problem fixed**

Students get admissions guidance that is more relevant than a generic chatbot and safer than a raw model call because Prelude constrains answers with approved behavior, public data, link allow-lists, and fallback logic.

### 3. Public dataset search APIs

Prelude exposes dataset-backed endpoints for college, program, career, high-school, and college-comparison search.

| Endpoint | Purpose |
|---|---|
| `GET /api/colleges/search` | Search colleges by query, state, max net price, major, limit, and offset. |
| `GET /api/colleges/:unitid` | Fetch a specific college by College Scorecard unit ID. |
| `GET /api/colleges/compare` | Compare multiple colleges, optionally in the context of a major. |
| `GET /api/programs/search` | Search academic programs by keyword and state. |
| `GET /api/careers/search` | Search career paths and related skills. |
| `GET /api/high-schools/search` | Search public high schools by name, state, or city. |

**Languages, APIs, and tools**

- Node.js API middleware and Vercel route wrappers.
- SQLite dataset access layer.
- Python and Bash dataset preparation scripts.
- Official/public data sources: College Scorecard, O\*NET, and NCES Common Core of Data.

**Problem fixed**

Students and mentors can explore schools, majors, outcomes, and high-school context from searchable data instead of relying on hard-coded examples or manual research.

### 4. PreludeMatch questionnaire and mentor matching flow

PreludeMatch guides students through a conditional questionnaire, prunes stale answers when earlier choices change, validates required fields, supports college-search answers, computes progress, and stores questionnaire submissions for account-linked matching.

**Languages, APIs, and tools**

- React questionnaire components and hero match animation components.
- JavaScript matching/question visibility logic.
- PostgreSQL `prelude_match_questionnaires` storage through Prisma migrations.
- API route for authenticated questionnaire persistence.

**Problem fixed**

Students can share goals, grade level, schools, interests, budget sensitivity, and support needs in a structured way so mentor matching and AI personalization start from real context rather than a blank chat box.

### 5. Secure self-hosted authentication

Prelude includes a complete account system with registration, email verification token generation, login, refresh-token rotation, logout, password reset, session management, profile updates, and protected account routes.

**Languages, APIs, and tools**

- Node.js auth middleware and Vercel handlers.
- Prisma + PostgreSQL account tables.
- Argon2id password hashing.
- JWT access tokens.
- Hashed refresh tokens in HTTP-only cookies.
- SameSite CSRF cookie and `X-CSRF-Token` checks for mutating requests.
- Zod request validation.

**Problem fixed**

Prelude can run with secure account management without paying for a third-party identity provider during local development or early validation.

### 6. Role-based authorization and account safety

Protected routes verify the JWT, active session, active user state, email verification, and role-specific database relationships before returning data. Students can access their own records, mentors can access assigned students, counselors are scoped to their organization, and admins can bypass scoped restrictions.

**Languages, APIs, and tools**

- PostgreSQL relationship tables for users, student profiles, mentor profiles, counselor profiles, organizations, and mentor assignments.
- Prisma authorization queries.
- Rate-limit buckets, login history, security events, and activity logs.

**Problem fixed**

Route parameters and frontend state are not trusted as authorization proof, which protects student data and mentor notes from cross-account access.

### 7. Student dashboard

The student dashboard includes an overview, calendar, Prelude AI panel, profile stats, application workspace, mentor profile, messages, and settings. It tracks application progress, deadlines, essay progress, profile completion, weekly missions, XP, streaks, achievements, AI insights, mentor meetings, essays, colleges, activities, tasks, scholarships, and integrations.

**Languages, APIs, and tools**

- React dashboard pages and reusable dashboard UI components.
- FullCalendar for calendar views.
- Dashboard API for authenticated role-specific data.
- Local/demo dashboard data for seeded experiences.
- Google Calendar and Zoom integration UI placeholders.

**Problem fixed**

Students can manage the admissions process in one place instead of using separate notes, calendars, spreadsheets, chats, and task lists.

### 8. Mentor dashboard

The mentor dashboard includes overview, calendar, assigned students, messages, availability, mentor profile, and detailed student profile pages. Mentors can view student priorities, progress, missions, achievements, notes, feedback, meeting history, and schedule meeting requests.

**Languages, APIs, and tools**

- React mentor pages and dashboard components.
- FullCalendar meeting/calendar components.
- Role guard components and dashboard route metadata.
- PostgreSQL mentor assignment relationships for protected backend access.

**Problem fixed**

Mentors have a centralized operating system for coaching students, reviewing progress, scheduling sessions, and keeping private notes separate from visible feedback.

### 9. Calendar, meetings, and messaging

Prelude includes meeting cards, detail modals, schedule forms, calendar event pills, calendar event modals, student/mentor message panels, message receipts, and meeting data helpers.

**Languages, APIs, and tools**

- React UI components.
- FullCalendar day grid, time grid, list, interaction, and React adapter packages.
- Shared meeting data utilities and demo meeting JSON.

**Problem fixed**

Students and mentors can coordinate deadlines, availability, sessions, and conversations without leaving the platform.

### 10. Gamification and roadmap tools

The application includes an application roadmap, weekly missions, level progress, XP, streaks, badges, activity feed, mission assignment, and progress bars across college list, essays, extracurriculars, scholarships, and profile completion.

**Languages, APIs, and tools**

- React dashboard gamification components.
- JavaScript roadmap and gamification data modules.
- Auth/profile helpers that attach roadmap state to user records.

**Problem fixed**

The admissions process becomes a sequence of visible, motivating next steps instead of an overwhelming checklist with unclear priorities.

### 11. Billing and membership management

Prelude supports Basic, Plus, and Pro plan concepts, disabled billing mode for local development, Stripe checkout for paid plans, Stripe customer portal access, and signed webhook handling for subscription updates.

**Languages, APIs, and tools**

- Stripe API for customers, checkout sessions, billing portal sessions, and webhook events.
- HMAC/SHA signature verification for webhooks.
- PostgreSQL user subscription fields and webhook event deduplication.
- React membership/account UI.

**Problem fixed**

Prelude can validate pricing and paid-plan flows without blocking development when Stripe credentials are absent, then switch to real subscriptions when configured.

### 12. Internationalization and accessibility-friendly UX

The app includes a language switcher, translation utilities, reduced-motion hook, responsive navigation, mobile menus, semantic dashboard sections, and reusable UI primitives.

**Languages, APIs, and tools**

- React context for language state.
- JavaScript translation catalog.
- CSS responsive and reduced-motion styling hooks.

**Problem fixed**

The product is easier to navigate across devices and better prepared for multilingual families and users sensitive to motion-heavy interfaces.

### 13. Local development and deployment flexibility

Prelude can run as a single Vite dev server with embedded API middleware, as separate frontend/backend processes, or through Vercel-compatible serverless API handlers.

**Languages, APIs, and tools**

- Vite dev server.
- Node standalone API server.
- Vercel route files under `api/`.
- Docker Compose for local PostgreSQL.
- Prisma migrations and seed scripts.

**Problem fixed**

Developers can work quickly in one process, debug backend routes separately, or deploy serverless endpoints without rewriting the API stack.

## API route summary

| Route group | Routes | What they solve |
|---|---|---|
| Chat | `POST /api/chat` | AI admissions guidance with RAG and provider fallback. |
| Auth | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/verify-email`, `/api/auth/request-reset`, `/api/auth/reset-password` | Secure account lifecycle and session management. |
| Account | `/api/account/profile`, `/api/account/sessions`, `/api/account/sessions/:id` | Profile updates and user-controlled session revocation. |
| Dashboard | `GET /api/dashboard`, `GET /api/students/:id` | Role-specific dashboard and protected student data. |
| Billing | `/api/billing/config`, `/api/billing/checkout`, `/api/billing/bundle-checkout`, `/api/billing/portal`, `/api/billing/webhook` | Plan and one-time bundle checkout, billing portal, subscription state, and webhook sync. |
| Datasets | `/api/colleges/*`, `/api/programs/search`, `/api/careers/search`, `/api/high-schools/search` | Public-data search and comparison. |
| PreludeMatch | `/api/prelude-match-questionnaire` | Account-linked questionnaire submission for matching/personalization. |

## Public page summary

| Route | What it provides |
|---|---|
| `/` | Landing page, plans, mentor network, academic support, and public CTAs. |
| `/contact` | Discovery-call scheduler and email contact page with Gmail and mail-client compose links. See `docs/contact-page.md`. |
| `/mentors` | Example mentor directory and mentor preview experience. |

## Quick start

```bash
npm install
cp .env.example .env
# Leave VITE_SUPABASE_* empty in .env for fully local sign-up/login (no cloud account).
npm run db:setup   # requires Docker Desktop running
npm run dev
```

Open [http://localhost:5173/register](http://localhost:5173/register) to create an account, or use the demo logins below after `db:setup`.

### Local PostgreSQL for auth and dashboards

Requires **Docker Desktop** (daemon running). Credentials in `compose.yml` and `.env.example` are development-only.

```bash
npm run db:setup      # Start Postgres + apply migrations + seed (non-interactive)
npm run db:reset      # Wipe local DB volume and run db:setup from scratch
# Or step by step:
npm run db:start      # Docker Compose — postgres:16 on localhost:5432
npm run db:migrate:deploy  # Apply existing migrations (no prompts)
npm run seed:demo     # Demo student/mentor accounts (local only)
```

If `db:setup` reports **P3005** (schema not empty), it will baseline migrations automatically. Use `npm run db:reset` for a clean slate.

Use `npm run db:migrate` only when you are **creating** a new Prisma migration (`migrate dev` prompts for a name).

Ensure `.env` includes:

```env
DATABASE_URL="postgresql://prelude:prelude_dev_password@localhost:5432/prelude_dev?schema=public"
JWT_ACCESS_SECRET="replace-with-a-long-random-secret"
PUBLIC_APP_URL="http://localhost:5173"
PRELUDE_LOG_AUTH_EMAILS=1
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Demo logins after seeding:

- Student: `student@prelude-demo.com` / `Student123!`
- Mentor: `mentor@prelude-demo.com` / `Mentor123!`

### Generate public datasets

```bash
bash prelude_dataset_kit/scripts/setup_datasets.sh
```

Generated dataset files live under `prelude_dataset_kit/data/` and should not be committed.

### Run the app on one dev port

```bash
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

### Run frontend and API separately

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
PRELUDE_STANDALONE_API=1 npm run dev
```

Or run both:

```bash
npm run dev:all
```

Override the backend port with `PRELUDE_API_PORT` when needed.

## AI provider configuration

All AI configuration is server-side only. Do not expose AI keys with `VITE_` variables.

### Production-style OpenAI setup

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Local Ollama setup

```bash
ollama serve
ollama pull gemma3
```

```env
AI_PROVIDER=ollama
OLLAMA_MODEL=gemma3
OLLAMA_BASE_URL=http://localhost:11434
```

If Ollama is not running or the model is missing, `/api/chat` returns a clear service error or safe fallback rather than failing silently.

## Billing configuration

Billing can remain disabled for local development. To enable Stripe, configure a least-privilege restricted key, webhook secret, and every Price ID listed in `.env.example`. Plus and Pro include flexible session credits for college consulting, SAT/ACT prep, and academic tutoring — there are no separate tutoring subscription price IDs in checkout.

```env
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_REFERRAL_COUPON_ID=prelude_referral_20_once
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PLUS=price_...
STRIPE_PRICE_ID_PRO=price_...
# See .env.example for the 14 one-time Essay Support and Flexible Sessions Price IDs.
```

When billing is disabled, the billing config endpoint reports disabled state and checkout/portal routes return a configuration response instead of attempting Stripe calls.

Run `npm run stripe:catalog -- --write-env` to create or reuse the Basic ($49.99), Plus ($149.99), and Pro ($249.99) monthly Prices plus every displayed Essay Support and Flexible Sessions one-time Price in test mode. The script defaults to test mode, is idempotent, and leaves outdated Prices active. For production, provide a Products/Prices-scoped restricted key as `STRIPE_LIVE_SECRET_KEY` and explicitly run `node scripts/setup-stripe-catalog.mjs --live`; copy the printed Price IDs into Cloudflare only after reviewing them. The script never writes either key.

Run `npm run stripe:referral -- --write-env` to create or verify the test-mode `prelude_referral_20_once` coupon (20% off, duration `once`) and write only its non-secret ID to `.env`. Run `node scripts/setup-stripe-referral.mjs --live` with a live key that has Coupons read/write access to create the identical live-mode coupon. Set `STRIPE_REFERRAL_COUPON_ID=prelude_referral_20_once` in Cloudflare Production and Preview where referral checkout is enabled.

Run `npm run stripe:domain -- --write-env` for test mode or `npm run stripe:domain:live -- --write-env` for live mode to register `https://preludeconsultingllc.com/api/billing/webhook`, subscribe it to the supported subscription/referral lifecycle events, and enable the `preludeconsultingllc.com` payment method domain. The setup refuses a key from the wrong Stripe mode. A newly created live signing secret is stored locally as `STRIPE_LIVE_WEBHOOK_SECRET`; deploy its value under the runtime name `STRIPE_WEBHOOK_SECRET` without committing either secret.

Cloudflare Pages uses the `functions/api/billing/*` routes for the custom domain. Set these production variables in Cloudflare Pages:

- `PUBLIC_APP_URL=https://preludeconsultingllc.com`
- `VITE_PUBLIC_APP_URL=https://preludeconsultingllc.com`
- `BILLING_PROVIDER=stripe`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- All 17 `STRIPE_PRICE_ID_*` variables listed in `.env.example`
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if webhook events should update Supabase profiles

Guest checkout on Cloudflare is disabled unless both `STRIPE_ALLOW_GUEST_CHECKOUT=true` and `VITE_ALLOW_GUEST_CHECKOUT=true` are set.

### Local Stripe webhook testing

The local webhook route is available at `/api/billing/webhook`. It verifies Stripe signatures with `STRIPE_WEBHOOK_SECRET`, records event IDs to avoid duplicate processing, and syncs subscription state for checkout, invoice, and subscription events.

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run stripe:webhook
```

Copy the `whsec_...` signing secret printed by Stripe CLI into `.env` as `STRIPE_WEBHOOK_SECRET`, then restart the dev server so the endpoint can verify forwarded events. If you run the standalone API server directly, use `npm run stripe:webhook:api` instead.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite frontend with embedded API middleware. |
| `npm run server` | Standalone Node API server on port `3001` by default. |
| `npm run dev:all` | Standalone API plus frontend proxy. |
| `npm run db:start` | Start local PostgreSQL through Docker Compose. |
| `npm run db:stop` | Stop the local PostgreSQL container. |
| `npm run db:migrate` | Apply Prisma migrations in development. |
| `npm run seed:demo` | Seed demo student and mentor accounts. |
| `npm run stripe:webhook` | Forward Stripe CLI webhook events to the Vite dev API route. |
| `npm run stripe:webhook:api` | Forward Stripe CLI webhook events to the standalone API server. |
| `npm run build` | Create a production Vite build. |
| `npm run preview` | Preview the production build locally. |
| `npm test` | Run Vitest, Node server tests, and API route smoke tests. |
| `npm run test:api:live` | Run live API tests against a running server. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run train:agent` | Run rule-based Prelude agent training checks. |

## Documentation

| Topic | Location |
|---|---|
| RAG, datasets, API routes, and testing | [docs/rag-and-datasets.md](docs/rag-and-datasets.md) |
| Supabase production auth, Google OAuth, six-digit verification, Resend, and Turnstile | [docs/supabase-production-auth.md](docs/supabase-production-auth.md) |
| Authentication and security | [docs/auth-security.md](docs/auth-security.md) |
| Database schema | [docs/database-schema.md](docs/database-schema.md) |
| Dataset kit setup | [prelude_dataset_kit/README.md](prelude_dataset_kit/README.md) |
| Dataset source notes | [prelude_dataset_kit/SOURCE_NOTES.md](prelude_dataset_kit/SOURCE_NOTES.md) |

## Security and repository hygiene

- Never commit `.env`, API keys, JWT secrets, Stripe secrets, or generated dataset files.
- Keep AI provider configuration on the server only.
- Use Prisma migrations for database changes.
- Use official/public data sources for admissions facts and confirm deadlines on each college's official site.
- Treat frontend route params as untrusted; authorization must come from backend session and relationship checks.
