/**
 * Cloudflare Pages Functions referral API (Fetch-native, no Node server middleware).
 */
import { enforceIpRateLimit } from "../../server/lib/ipRateLimit.js";
import { createSupabaseAdmin, createSupabaseUserClient } from "../../server/lib/supabasePasswordReset.js";
import {
  REFERRAL_CLAIM_LEAD_DAYS,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_REWARD_NOTIFICATION,
  isReferralEligibleRole,
  logReferralEvent,
  normalizeReferralCodeInput,
  publicReferralError
} from "../../shared/referralConstants.js";

const VALIDATE_LIMIT = 20;
const VALIDATE_WINDOW_SECONDS = 15 * 60;
const STRIPE_API_VERSION = "2026-05-27.dahlia";

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function envFromContext(context) {
  return {
    ...context.env,
    NODE_ENV: context.env?.NODE_ENV || "production",
    SUPABASE_URL: context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL,
    SUPABASE_ANON_KEY: context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
    RATE_LIMIT_SECRET: context.env?.RATE_LIMIT_SECRET || context.env?.SUPABASE_SERVICE_ROLE_KEY
  };
}

function requestFromContext(context) {
  const request = context.request;
  const url = new URL(request.url);
  const clientIp =
    request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "";
  return {
    method: request.method,
    headers: {
      authorization: request.headers.get("Authorization") || "",
      host: url.host,
      "x-forwarded-host": request.headers.get("x-forwarded-host") || url.host,
      "x-forwarded-proto": request.headers.get("x-forwarded-proto") || url.protocol.replace(":", ""),
      "x-forwarded-for": clientIp
    },
    socket: { remoteAddress: clientIp }
  };
}

function cors(methods) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

async function requireUser(context, env) {
  const bearer = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!bearer) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  const client = createSupabaseUserClient(bearer, env);
  if (!client) {
    const error = new Error("Supabase is not configured.");
    error.statusCode = 503;
    throw error;
  }
  const { data, error } = await client.auth.getUser(bearer);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }
  return data.user;
}

async function resolveAssociateUser(context, env, payload) {
  const bearer = context.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (bearer) {
    const user = await requireUser(context, env);
    return { userId: user.id, email: user.email, role: payload.role || user.user_metadata?.role };
  }
  if (payload.userId && payload.email) {
    const supabase = createSupabaseAdmin(env);
    if (!supabase) {
      const error = new Error("Authentication required.");
      error.statusCode = 401;
      throw error;
    }
    const { data, error } = await supabase.auth.admin.getUserById(payload.userId);
    if (error || !data?.user) {
      const authError = new Error("Authentication required.");
      authError.statusCode = 401;
      throw authError;
    }
    if (data.user.email?.toLowerCase() !== String(payload.email).toLowerCase()) {
      const mismatch = new Error("This referral code is not available for this account.");
      mismatch.statusCode = 403;
      throw mismatch;
    }
    const createdAt = new Date(data.user.created_at || 0).getTime();
    if (Date.now() - createdAt > 30 * 60 * 1000) {
      const expired = new Error("Authentication required.");
      expired.statusCode = 401;
      throw expired;
    }
    return { userId: data.user.id, email: data.user.email, role: payload.role };
  }
  const error = new Error("Authentication required.");
  error.statusCode = 401;
  throw error;
}

async function validateCode(supabase, { code, role, userId }) {
  const normalized = normalizeReferralCodeInput(code);
  if (!normalized) {
    return { valid: false, error: "invalid_request", message: publicReferralError("invalid_request") };
  }
  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "mentor") {
    return { valid: false, error: "mentor_ineligible", message: publicReferralError("mentor_ineligible") };
  }
  if (normalizedRole && !isReferralEligibleRole(normalizedRole)) {
    return { valid: false, error: "role_ineligible", message: publicReferralError("role_ineligible") };
  }

  const { data: codeRow } = await supabase
    .from("referral_codes")
    .select("id, household_id, code, normalized_code, status")
    .eq("normalized_code", normalized)
    .maybeSingle();

  if (!codeRow) {
    return { valid: false, error: "not_found", message: publicReferralError("not_found") };
  }
  if (codeRow.status !== "active") {
    return { valid: false, error: "disabled", message: publicReferralError("disabled") };
  }

  if (userId) {
    const { data: householdId } = await supabase.rpc("ensure_household_for_user", { p_user_id: userId });
    if (householdId && householdId === codeRow.household_id) {
      return { valid: false, error: "self_referral", message: publicReferralError("self_referral") };
    }
    const { data: prior } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", userId)
      .in("status", ["entered", "pending_account", "pending_payment", "confirmed"])
      .maybeSingle();
    if (prior) {
      return { valid: false, error: "already_referred", message: publicReferralError("already_referred") };
    }
  }

  return {
    valid: true,
    code: codeRow.code,
    referralCodeId: codeRow.id,
    referrerHouseholdId: codeRow.household_id,
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
    message: "Referral code applied. You’ll receive 20% off your first monthly subscription payment."
  };
}

async function handleCode(context, env, supabase) {
  if (context.request.method === "OPTIONS") return cors("GET, OPTIONS");
  if (context.request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const user = await requireUser(context, env);
  const { data, error } = await supabase.rpc("get_or_create_my_referral_code");
  // User JWT RPCs need the user client — retry with user-scoped call via admin ensure path
  if (error || data == null) {
    const { data: profile } = await supabase.from("profiles").select("id, role, full_name, preferred_name").eq("id", user.id).maybeSingle();
    if (!profile || !isReferralEligibleRole(profile.role)) {
      return json({ eligible: false, error: "role_ineligible", message: publicReferralError("role_ineligible") });
    }
    const { data: householdId, error: hhError } = await supabase.rpc("ensure_household_for_user", {
      p_user_id: user.id
    });
    if (hhError || !householdId) {
      return json({ eligible: false, error: "server_error", message: publicReferralError("server_error") }, 500);
    }
    const seed = profile.preferred_name || profile.full_name || "FRIEND";
    const { data: codeRow, error: codeError } = await supabase.rpc("ensure_referral_code_for_household", {
      p_household_id: householdId,
      p_seed_name: seed
    });
    if (codeError || !codeRow) {
      return json({ eligible: false, error: "server_error", message: publicReferralError("server_error") }, 500);
    }
    logReferralEvent("referral_code_viewed", { userId: user.id, householdId });
    return json({
      ok: true,
      eligible: true,
      code: codeRow.code,
      normalizedCode: codeRow.normalized_code,
      status: codeRow.status,
      householdId
    });
  }
  logReferralEvent("referral_code_viewed", { userId: user.id });
  return json({ ok: true, ...data });
}

async function handleValidate(context, env, supabase) {
  if (context.request.method === "OPTIONS") return cors("POST, OPTIONS");
  if (context.request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/referral/validate",
    VALIDATE_LIMIT,
    VALIDATE_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    return json(
      { valid: false, error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.statusCode,
      rateLimitError.retryAfterSeconds ? { "Retry-After": String(rateLimitError.retryAfterSeconds) } : {}
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ valid: false, error: "validation_error", message: "Invalid request body." }, 400);
  }

  let userId = null;
  try {
    userId = (await requireUser(context, env)).id;
  } catch {
    /* public validate allowed */
  }

  const result = await validateCode(supabase, {
    code: payload.code,
    role: payload.role,
    userId
  });
  logReferralEvent("referral_code_submitted_validate", { valid: result.valid, error: result.error || null, userId });
  return json({
    valid: Boolean(result.valid),
    code: result.code || null,
    message: result.message,
    error: result.error || null,
    discountPercent: result.discountPercent || null
  });
}

async function handleAssociate(context, env, supabase) {
  if (context.request.method === "OPTIONS") return cors("POST, OPTIONS");
  if (context.request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }

  const identity = await resolveAssociateUser(context, env, payload);
  const validation = await validateCode(supabase, {
    code: payload.code,
    role: identity.role,
    userId: identity.userId
  });
  if (!validation.valid) {
    return json({ success: false, ...validation }, 400);
  }

  const { data: householdId } = await supabase.rpc("ensure_household_for_user", { p_user_id: identity.userId });
  const { data: referral, error } = await supabase
    .from("referrals")
    .insert({
      referral_code_id: validation.referralCodeId,
      referrer_household_id: validation.referrerHouseholdId,
      referred_household_id: householdId,
      referred_user_id: identity.userId,
      status: "pending_payment",
      metadata: {}
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return json({ success: false, error: "already_referred", message: publicReferralError("already_referred") }, 400);
    }
    return json({ success: false, error: "server_error", message: publicReferralError("server_error") }, 500);
  }

  await supabase.from("profiles").update({ pending_referral_id: referral.id }).eq("id", identity.userId);
  logReferralEvent("referral_code_submitted", { userId: identity.userId, referralId: referral.id });
  return json({
    success: true,
    referralId: referral.id,
    code: validation.code,
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
    message: validation.message
  });
}

async function handleRewards(context, env, supabase) {
  if (context.request.method === "OPTIONS") return cors("GET, OPTIONS");
  if (context.request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const user = await requireUser(context, env);
  const { data: profile } = await supabase.from("profiles").select("role, household_id").eq("id", user.id).maybeSingle();
  if (!profile || !isReferralEligibleRole(profile.role)) {
    return json({ eligible: false, rewards: [] });
  }
  let householdId = profile.household_id;
  if (!householdId) {
    const { data } = await supabase.rpc("ensure_household_for_user", { p_user_id: user.id });
    householdId = data;
  }
  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  return json({ eligible: true, householdId, rewards: rewards || [] });
}

async function stripeRequest(env, method, path, bodyParams = null) {
  const secret = (env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Stripe is not configured.");
  const headers = {
    Authorization: `Bearer ${secret}`,
    "Stripe-Version": STRIPE_API_VERSION
  };
  let body;
  if (bodyParams) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = bodyParams instanceof URLSearchParams ? bodyParams.toString() : bodyParams;
  }
  const response = await fetch(`https://api.stripe.com${path}`, { method, headers, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Stripe request failed.");
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function resolveReferralCouponId(env) {
  const configured = (env.STRIPE_REFERRAL_COUPON_ID || "").trim();
  if (configured) return configured;
  const listed = await stripeRequest(env, "GET", "/v1/coupons?limit=100");
  const existing = (listed.data || []).find(
    (c) => c.id === "prelude_referral_20_once" || c.metadata?.preludeReferral === "true"
  );
  if (existing) return existing.id;
  const params = new URLSearchParams();
  params.set("id", "prelude_referral_20_once");
  params.set("percent_off", "20");
  params.set("duration", "once");
  params.set("name", "Prelude referral 20% (one month)");
  params.set("metadata[preludeReferral]", "true");
  const created = await stripeRequest(env, "POST", "/v1/coupons", params);
  return created.id;
}

async function handleClaim(context, env, supabase) {
  if (context.request.method === "OPTIONS") return cors("POST, OPTIONS");
  if (context.request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await requireUser(context, env);
  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }
  const rewardId = payload.rewardId;
  if (!rewardId) {
    return json({ success: false, error: "validation_error", message: "rewardId is required." }, 400);
  }

  const { data: profile } = await supabase.from("profiles").select("id, role, household_id").eq("id", user.id).maybeSingle();
  if (!profile || !isReferralEligibleRole(profile.role)) {
    return json({ success: false, error: "role_ineligible", message: publicReferralError("role_ineligible") }, 400);
  }
  let householdId = profile.household_id;
  if (!householdId) {
    const { data } = await supabase.rpc("ensure_household_for_user", { p_user_id: user.id });
    householdId = data;
  }

  const { data: reward } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (!reward || reward.status !== "available") {
    const code = reward && ["claimed", "scheduled", "applied"].includes(reward.status) ? "reward_already_claimed" : "reward_unavailable";
    return json({ success: false, error: code, message: publicReferralError(code) }, 409);
  }

  const { data: inflight } = await supabase
    .from("referral_rewards")
    .select("id")
    .eq("household_id", householdId)
    .in("status", ["claimed", "scheduled"])
    .neq("id", rewardId)
    .maybeSingle();
  if (inflight) {
    return json(
      {
        success: false,
        error: "reward_unavailable",
        message:
          "Another referral reward is already scheduled for your next payment. Additional rewards stay queued for later billing cycles."
      },
      400
    );
  }

  const { data: members } = await supabase.from("household_members").select("user_id").eq("household_id", householdId);
  const ids = (members || []).map((m) => m.user_id);
  if (!ids.includes(user.id)) ids.push(user.id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, stripe_subscription_id, subscription_status, payment_waived")
    .in("id", ids);
  const eligible = (profiles || []).find(
    (p) =>
      p.stripe_subscription_id &&
      ["active", "trialing"].includes(String(p.subscription_status || "").toLowerCase()) &&
      !p.payment_waived
  );
  if (!eligible) {
    return json({ success: false, error: "subscription_ineligible", message: publicReferralError("subscription_ineligible") }, 400);
  }

  const subscription = await stripeRequest(env, "GET", `/v1/subscriptions/${encodeURIComponent(eligible.stripe_subscription_id)}`);
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
  const msLeft = periodEnd ? periodEnd.getTime() - Date.now() : null;
  if (msLeft == null || msLeft < REFERRAL_CLAIM_LEAD_DAYS * 24 * 60 * 60 * 1000) {
    return json(
      {
        success: false,
        error: "claim_cutoff",
        message: publicReferralError("claim_cutoff"),
        remainsAvailable: true,
        currentPeriodEnd: periodEnd
      },
      409
    );
  }

  const { data: claimed, error: claimError } = await supabase
    .from("referral_rewards")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by_user_id: user.id,
      scheduled_billing_period: periodEnd.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", rewardId)
    .eq("status", "available")
    .select("*")
    .maybeSingle();

  if (claimError || !claimed) {
    return json({ success: false, error: "claim_race", message: publicReferralError("claim_race") }, 409);
  }

  try {
    const couponId = await resolveReferralCouponId(env);
    const params = new URLSearchParams();
    params.set("discounts[0][coupon]", couponId);
    params.set("metadata[preludeReferralReward]", "true");
    params.set("metadata[referralRewardId]", rewardId);
    for (const [key, value] of Object.entries(subscription.metadata || {})) {
      if (key === "preludeReferralReward" || key === "referralRewardId") continue;
      params.set(`metadata[${key}]`, String(value));
    }
    await stripeRequest(env, "POST", `/v1/subscriptions/${encodeURIComponent(subscription.id)}`, params);

    await supabase
      .from("referral_rewards")
      .update({
        status: "scheduled",
        stripe_coupon_id: couponId,
        updated_at: new Date().toISOString()
      })
      .eq("id", rewardId);

    if (Array.isArray(reward.notification_ids) && reward.notification_ids.length) {
      await supabase
        .from("notifications")
        .update({
          action_completed_at: new Date().toISOString(),
          body: `${REFERRAL_REWARD_NOTIFICATION.body}\n\nClaimed — discount expected on ${periodEnd.toLocaleDateString()}.`,
          unread: false
        })
        .in("id", reward.notification_ids);
    }

    logReferralEvent("reward_claim_succeeded", { rewardId, userId: user.id });
    return json({
      success: true,
      appliesOn: periodEnd.toISOString(),
      message: `Reward claimed. Your 20% discount is scheduled for your payment on ${periodEnd.toLocaleDateString()}.`
    });
  } catch (error) {
    await supabase
      .from("referral_rewards")
      .update({
        status: "available",
        claimed_at: null,
        claimed_by_user_id: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", rewardId);
    return json(
      { success: false, error: "server_error", message: error.message || publicReferralError("server_error") },
      error.statusCode || 500
    );
  }
}

export async function onRequest(context) {
  const env = envFromContext(context);
  const supabase = createSupabaseAdmin(env);
  if (!supabase) {
    return json(
      {
        error: "referral_unavailable",
        message: "Referral codes are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      },
      503
    );
  }

  const pathname = new URL(context.request.url).pathname.replace(/\/$/, "");

  try {
    if (pathname.endsWith("/api/referral/code")) return await handleCode(context, env, supabase);
    if (pathname.endsWith("/api/referral/validate")) return await handleValidate(context, env, supabase);
    if (pathname.endsWith("/api/referral/associate")) return await handleAssociate(context, env, supabase);
    if (pathname.endsWith("/api/referral/rewards")) return await handleRewards(context, env, supabase);
    if (pathname.endsWith("/api/referral/claim")) return await handleClaim(context, env, supabase);
    return json({ error: "not_found" }, 404);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("[prelude-referral]", error);
    return json(
      {
        error: error.code || (status >= 500 ? "server_error" : "request_failed"),
        message: error.message || publicReferralError("server_error")
      },
      status
    );
  }
}
