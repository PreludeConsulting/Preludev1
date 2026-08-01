/**
 * GET /api/auth/me — Cloudflare Pages Function
 *
 * Mirrors the Node/Vercel contract used by src/lib/auth.js:
 *   - Authenticated: { user, csrfToken }
 *   - Unauthenticated: 401 JSON { error, message }
 *
 * Production auth is Supabase (Bearer). Cookie-based Prisma sessions are not
 * available in Workers; without a Bearer token this returns 401 JSON so the
 * SPA shell is never returned for this path.
 */

import {
  corsHeaders,
  errorResponse,
  handlePreflight,
  json,
  methodNotAllowed,
  requireUser,
  rest,
  first
} from "../../_lib/http.js";

function randomToken(bytes = 24) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

function csrfCookie(token) {
  const secure = true;
  return `prelude_csrf=${encodeURIComponent(token)}; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${secure ? "; Secure" : ""}`;
}

function mapPublicUser(authUser, profile) {
  const firstName =
    profile?.full_name?.trim()?.split(/\s+/)?.[0] ||
    authUser.user_metadata?.first_name ||
    authUser.user_metadata?.full_name?.trim()?.split(/\s+/)?.[0] ||
    "";
  const lastName =
    profile?.full_name?.trim()?.split(/\s+/)?.slice(1).join(" ") ||
    authUser.user_metadata?.last_name ||
    "";
  const role = String(profile?.role || authUser.user_metadata?.role || "student").toUpperCase();
  const plan = String(profile?.plan_id || authUser.user_metadata?.plan || "basic").toLowerCase();
  return {
    id: authUser.id,
    firstName,
    lastName,
    name: profile?.full_name || `${firstName} ${lastName}`.trim() || authUser.email || "",
    email: authUser.email || profile?.email || "",
    role,
    plan,
    emailVerified: Boolean(authUser.email_confirmed_at || authUser.confirmed_at),
    status: "ACTIVE",
    subscriptionStatus: profile?.subscription_status || null,
    subscriptionCurrentPeriodEnd: profile?.subscription_current_period_end || null,
    hasBillingCustomer: Boolean(profile?.stripe_customer_id),
    createdAt: authUser.created_at || null
  };
}

export async function handleAuthMe(context) {
  const method = context.request.method.toUpperCase();
  if (method === "OPTIONS") return handlePreflight(context, { methods: "GET, OPTIONS" });
  if (method !== "GET") return methodNotAllowed("GET, OPTIONS");

  const headers = corsHeaders(context, { methods: "GET, OPTIONS" });

  try {
    const { user, token } = await requireUser(context);
    let profile = null;
    try {
      const rows = await rest(
        context,
        token,
        `profiles?select=id,role,full_name,email,plan_id,subscription_status,subscription_current_period_end,stripe_customer_id&id=eq.${encodeURIComponent(user.id)}&limit=1`
      );
      profile = first(rows);
    } catch {
      profile = null;
    }

    const csrfToken = randomToken(24);
    return json(
      {
        user: mapPublicUser(user, profile),
        csrfToken
      },
      200,
      { ...headers, "Set-Cookie": csrfCookie(csrfToken) }
    );
  } catch (error) {
    if (error?.statusCode === 401 || error?.status === 401 || error?.code === "unauthenticated") {
      return json(
        { error: "unauthenticated", message: "Authentication required." },
        401,
        headers
      );
    }
    return errorResponse(error, { label: "auth-me", extraHeaders: headers });
  }
}

export function onRequest(context) {
  return handleAuthMe(context);
}
