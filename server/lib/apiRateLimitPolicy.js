export const RATE_LIMIT_TIERS = Object.freeze({
  ai: {
    windows: Object.freeze([
      Object.freeze({ limit: 8, windowSeconds: 60 }),
      Object.freeze({ limit: 80, windowSeconds: 60 * 60 })
    ]),
    failClosed: true
  },
  money: {
    windows: Object.freeze([
      Object.freeze({ limit: 5, windowSeconds: 60 }),
      Object.freeze({ limit: 30, windowSeconds: 60 * 60 })
    ]),
    failClosed: true
  },
  auth_email: {
    windows: Object.freeze([
      Object.freeze({ limit: 5, windowSeconds: 60 * 60 })
    ]),
    failClosed: false
  },
  auth_session: {
    windows: Object.freeze([
      Object.freeze({ limit: 10, windowSeconds: 15 * 60 })
    ]),
    failClosed: false
  },
  write: {
    windows: Object.freeze([
      Object.freeze({ limit: 30, windowSeconds: 60 }),
      Object.freeze({ limit: 300, windowSeconds: 60 * 60 })
    ]),
    failClosed: false
  },
  read_private: {
    windows: Object.freeze([
      Object.freeze({ limit: 240, windowSeconds: 60 }),
      Object.freeze({ limit: 2000, windowSeconds: 60 * 60 })
    ]),
    failClosed: false
  },
  read_public: {
    windows: Object.freeze([
      Object.freeze({ limit: 120, windowSeconds: 60 }),
      Object.freeze({ limit: 1000, windowSeconds: 60 * 60 })
    ]),
    failClosed: false
  },
  admin: {
    windows: Object.freeze([
      Object.freeze({ limit: 60, windowSeconds: 60 })
    ]),
    failClosed: false
  }
});

export const EXEMPT_API_ROUTE_PATTERNS = Object.freeze([
  "/api/billing/webhook",
  "/api/stripe-webhook",
  "/api/cron/rotate-referral-codes"
]);

const ROUTE_POLICIES = Object.freeze([
  { pattern: "/api/chat", tier: "ai" },

  { pattern: "/api/billing/webhook", exempt: true },
  { pattern: "/api/stripe-webhook", exempt: true },
  { pattern: "/api/billing/config", tier: "read_public" },
  { pattern: "/api/billing/checkout", tier: "money" },
  { pattern: "/api/billing/bundle-checkout", tier: "money" },
  { pattern: "/api/billing/confirm-session", tier: "money" },
  { pattern: "/api/billing/portal", tier: "money" },
  { pattern: "/api/billing/change-plan", tier: "money" },
  { pattern: "/api/billing/cancel", tier: "money" },
  { pattern: "/api/billing/reactivate", tier: "money" },
  { pattern: "/api/billing/consume-essay-review", tier: "money" },
  { pattern: "/api/billing/summary", tier: "read_private" },
  { pattern: "/api/me/subscription", tier: "read_private" },
  { pattern: "/api/billing/history", tier: "read_private" },

  { pattern: "/api/auth/send-signup-verification", tier: "auth_email" },
  { pattern: "/api/auth/resend-verification", tier: "auth_email" },
  { pattern: "/api/auth/request-password-reset", tier: "auth_email" },
  { pattern: "/api/auth/request-reset", tier: "auth_email" },
  { pattern: "/api/auth/create-login-challenge", tier: "auth_email" },
  { pattern: "/api/auth/resend-login-challenge", tier: "auth_email" },
  { pattern: "/api/auth/login-verification/send", tier: "auth_email" },
  { pattern: "/api/auth/register", tier: "auth_session" },
  { pattern: "/api/auth/login", tier: "auth_session" },
  { pattern: "/api/auth/reset-password", tier: "auth_session" },
  { pattern: "/api/auth/verify-email", tier: "auth_session" },
  { pattern: "/api/auth/verify-login-challenge", tier: "auth_session" },
  { pattern: "/api/auth/login-verification/check", tier: "auth_session" },
  { pattern: "/api/auth/login-verification/verify", tier: "auth_session" },
  { pattern: "/api/auth/login-verification/clear", tier: "auth_session" },
  { pattern: "/api/auth/me", tier: "read_private" },
  { pattern: "/api/auth/refresh", tier: "auth_session" },
  { pattern: "/api/auth/logout", tier: "auth_session" },
  { pattern: "/api/auth/trusted-devices", tier: "read_private", methodTiers: { DELETE: "write" } },
  { pattern: "/api/auth/trusted-devices/:id", tier: "read_private", methodTiers: { DELETE: "write" } },

  { pattern: "/api/account/profile", tier: "read_private", methodTiers: { PATCH: "write", POST: "write" } },
  { pattern: "/api/account/sessions", tier: "read_private", methodTiers: { DELETE: "write", POST: "write" } },
  { pattern: "/api/account/sessions/:id", tier: "read_private", methodTiers: { DELETE: "write" } },
  { pattern: "/api/account/verify-password", tier: "auth_session" },
  { pattern: "/api/account/delete", tier: "auth_session" },
  { pattern: "/api/account/deleted-notify", tier: "auth_email" },

  { pattern: "/api/dashboard", tier: "read_private" },
  { pattern: "/api/dashboard/app-data", tier: "read_private" },
  { pattern: "/api/dashboard/profile", tier: "read_private", methodTiers: { PATCH: "write", POST: "write" } },
  { pattern: "/api/dashboard/settings", tier: "read_private", methodTiers: { PATCH: "write", POST: "write" } },
  { pattern: "/api/dashboard/availability", tier: "read_private", methodTiers: { PUT: "write", POST: "write" } },

  { pattern: "/api/activities", tier: "read_private", methodTiers: { POST: "write", PATCH: "write", PUT: "write", DELETE: "write" } },
  { pattern: "/api/activities/:path*", tier: "read_private", methodTiers: { POST: "write", PATCH: "write", PUT: "write", DELETE: "write" } },
  { pattern: "/api/meetings", tier: "read_private", methodTiers: { POST: "write", PATCH: "write", PUT: "write", DELETE: "write" } },
  { pattern: "/api/meetings/:id", tier: "read_private", methodTiers: { POST: "write", PATCH: "write", PUT: "write", DELETE: "write" } },
  { pattern: "/api/integrations", tier: "read_private" },
  { pattern: "/api/integrations/google-calendar/connect", tier: "write" },
  { pattern: "/api/integrations/google-calendar/disconnect", tier: "write" },
  { pattern: "/api/integrations/zoom/connect", tier: "write" },
  { pattern: "/api/integrations/zoom/disconnect", tier: "write" },
  { pattern: "/api/onboarding/mentor-selection", tier: "write" },
  { pattern: "/api/parent-invites/send", tier: "auth_email" },
  { pattern: "/api/prelude-match-questionnaire", tier: "read_private", methodTiers: { POST: "write" } },
  { pattern: "/api/prelude-match/submit", tier: "auth_email" },
  { pattern: "/api/college-recommendations", tier: "read_private" },
  { pattern: "/api/students/:id", tier: "read_private" },

  { pattern: "/api/colleges/search", tier: "read_public" },
  { pattern: "/api/colleges/compare", tier: "read_public" },
  { pattern: "/api/colleges/:unitid", tier: "read_public" },
  { pattern: "/api/programs/search", tier: "read_public" },
  { pattern: "/api/careers/search", tier: "read_public" },
  { pattern: "/api/high-schools/search", tier: "read_public" },

  { pattern: "/api/promo/validate", tier: "read_public" },
  { pattern: "/api/promo/redeem-at-signup", tier: "write" },
  { pattern: "/api/referral/validate", tier: "read_public" },
  { pattern: "/api/referral/code", tier: "read_private" },
  { pattern: "/api/referral/rewards", tier: "read_private" },
  { pattern: "/api/referral/associate", tier: "write" },
  { pattern: "/api/referral/claim", tier: "money" },

  { pattern: "/api/support/bug-report", tier: "auth_email" },
  { pattern: "/api/contact/book-call", tier: "auth_email" },

  { pattern: "/api/admin/promo-codes", tier: "admin" },
  { pattern: "/api/admin/referral/rotate-codes", tier: "admin" },
  { pattern: "/api/admin/mentor-review", tier: "admin" },
  { pattern: "/api/admin/mentor-review/access", tier: "admin" },
  { pattern: "/api/admin/mentor-review/:studentId/assign", tier: "admin" },

  { pattern: "/api/cron/rotate-referral-codes", exempt: true },

  // Cloudflare Pages optional catch-all (`functions/api/[[path]].js`) and unknown /api fallbacks.
  { pattern: "/api/:path*", tier: "read_public" }
]);

export const API_RATE_LIMIT_ROUTE_POLICIES = ROUTE_POLICIES;

function normalizePathname(pathname) {
  const withoutQuery = String(pathname || "/").split("?")[0] || "/";
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, "") : withoutQuery;
}

function segmentMatches(patternSegment, pathSegment) {
  return patternSegment === pathSegment || patternSegment.startsWith(":");
}

function routeMatches(pattern, pathname) {
  const patternSegments = normalizePathname(pattern).split("/").filter(Boolean);
  const pathSegments = normalizePathname(pathname).split("/").filter(Boolean);
  const starIndex = patternSegments.findIndex((segment) => segment.endsWith("*"));
  if (starIndex >= 0) {
    if (pathSegments.length < starIndex) return false;
    return patternSegments.slice(0, starIndex).every((segment, index) => segmentMatches(segment, pathSegments[index]));
  }
  if (patternSegments.length !== pathSegments.length) return false;
  return patternSegments.every((segment, index) => segmentMatches(segment, pathSegments[index]));
}

export function resolveApiRateLimitPolicy(pathname, method = "GET") {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "OPTIONS") return { exempt: true, reason: "preflight" };

  const normalizedPathname = normalizePathname(pathname);
  const policy = ROUTE_POLICIES.find((entry) => routeMatches(entry.pattern, normalizedPathname));
  if (!policy) return null;
  if (policy.exempt) return { ...policy, exempt: true };

  const tier = policy.methodTiers?.[normalizedMethod] || policy.tier;
  return {
    ...policy,
    tier,
    tierConfig: RATE_LIMIT_TIERS[tier],
    exempt: false
  };
}

export function routePatternFromApiFile(filePath) {
  const normalized = String(filePath).replaceAll("\\", "/");
  const marker = normalized.includes("/functions/api/")
    ? "/functions/api/"
    : normalized.startsWith("functions/api/")
      ? "functions/api/"
      : normalized.includes("/api/")
        ? "/api/"
        : normalized.startsWith("api/")
          ? "api/"
          : null;
  if (!marker) return null;

  const relative = normalized.slice(normalized.indexOf(marker) + marker.length).replace(/\.js$/, "");
  const withoutIndex = relative === "index" ? "" : relative.replace(/\/index$/, "");
  const route = withoutIndex
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const optionalCatchAll = segment.match(/^\[\[(.+)\]\]$/);
      if (optionalCatchAll) return `:${optionalCatchAll[1]}*`;
      const catchAll = segment.match(/^\[\.\.\.(.+)\]$/);
      if (catchAll) return `:${catchAll[1]}*`;
      const dynamic = segment.match(/^\[(.+)\]$/);
      if (dynamic) return `:${dynamic[1]}`;
      return segment;
    })
    .join("/");
  return `/api${route ? `/${route}` : ""}`;
}
