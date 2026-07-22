# Prelude route and action map

`shared/appRouteRegistry.js` is the executable source of truth for public routes, landing-page sections, dashboard role bases, and named cross-surface actions. Frontend navigation and server-generated Prelude AI actions must resolve through this registry instead of writing hashes or duplicating paths.

| Intent | Kind | Canonical target |
| --- | --- | --- |
| Home/logo/About/top | top | `/` |
| Explore or compare plans | landing section | `#pricing` |
| Find a mentor / PreludeMatch | route | `/mentors` |
| Sign up | route | `/register` |
| Sign in | route | `/login` |
| Open dashboard | route | `/dashboard` |
| Contact from landing content | landing section | `#contact` |
| How it works | landing section | `#how-it-works` |

Top intent is always hash-free. Deliberate landing sections retain a shareable hash. Role-specific dashboard destinations are derived from `DASHBOARD_ROUTE_BASES`; legacy aliases are normalized by `src/lib/dashboardRoutes.js` and `DashboardRouter`.

The registry contract is enforced by `tests/appRouteRegistry.test.js`, the landing navigation suite, dashboard route reliability tests, server Prelude-link tests, and Playwright route checks. Add a named action here before exposing a new global CTA.
