import { enforceIpRateLimit, hashClientIp } from "../../server/lib/ipRateLimit.js";
import { createSupabaseAdmin, createSupabaseUserClient } from "../../server/lib/supabasePasswordReset.js";
import {
  normalizePromoCodeInput,
  promoPlanLabel,
  publicPromoError,
  PROMO_CODE_PATTERN
} from "../../shared/promoCodeConstants.js";

const VALIDATE_LIMIT = 20;
const VALIDATE_WINDOW_SECONDS = 15 * 60;
const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_SECONDS = 60 * 60;

function json(payload, status = 200, headers = {}) {
  const responseHeaders = headers instanceof Headers ? headers : new Headers(headers);
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify(payload), { status, headers: responseHeaders });
}

function envFromContext(context) {
  return {
    ...context.env,
    NODE_ENV: context.env?.NODE_ENV || "production"
  };
}

function requestFromContext(context) {
  const request = context.request;
  const url = new URL(request.url);
  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for") ||
    "";
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

async function hashPromoCode(code) {
  const normalized = normalizePromoCodeInput(code);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildPromoSummary(validation) {
  const permanent = Boolean(validation.permanentAccess);
  const accessPeriod = permanent
    ? "Complimentary access — no expiration"
    : validation.accessDurationDays
      ? `${validation.accessDurationDays} days of complimentary access`
      : "Limited complimentary access";

  const renewalTerms =
    validation.renewalBehavior === "requires_payment"
      ? permanent
        ? "No payment is required unless you upgrade to a paid plan."
        : "When your promotional access ends, you will need to add a payment method to continue."
      : "See your confirmation email for renewal details.";

  const planId = validation.planId || "basic";
  return {
    plan: promoPlanLabel(planId),
    planId,
    priceToday: "$0.00",
    paymentMethodRequired: false,
    accessPeriod,
    renewalTerms,
    campaignName: validation.campaignName || null,
    permanentAccess: permanent,
    promotionEndsAt: validation.promotionEndsAt || null
  };
}

async function logValidationAttempt(supabase, { codeHash, email, ipHash, success, errorCode }) {
  if (!supabase) return;
  await supabase.from("promo_validation_attempts").insert({
    code_hash: codeHash || null,
    email: email ? email.toLowerCase() : null,
    ip_hash: ipHash || null,
    success: Boolean(success),
    error_code: errorCode || null
  });
}

async function validatePromoCodeSupabase(supabase, { code, email, userId, ipHash }) {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized) {
    return { valid: false, error: "not_found", message: publicPromoError("not_found") };
  }
  if (!PROMO_CODE_PATTERN.test(normalized)) {
    return { valid: false, error: "invalid_code_format", message: publicPromoError("invalid_code_format") };
  }

  const codeHash = await hashPromoCode(normalized);
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code_hash: codeHash,
    p_email: email || null,
    p_user_id: userId || null
  });

  if (error) {
    if (/relation .*promo_codes.* does not exist/i.test(error.message || "")) {
      return {
        valid: false,
        error: "server_error",
        message: "Promo codes are not set up yet. Ask an administrator to run the promo migration."
      };
    }
    return { valid: false, error: "server_error", message: publicPromoError("server_error") };
  }

  const result = data || { valid: false, error: "not_found" };
  const valid = Boolean(result.valid);
  const errorCode = valid ? null : result.error || "not_found";
  await logValidationAttempt(supabase, { codeHash, email, ipHash, success: valid, errorCode });

  if (!valid) {
    return { valid: false, error: errorCode, message: publicPromoError(errorCode) };
  }

  return {
    valid: true,
    code: normalized,
    message: "Promo code applied successfully",
    summary: buildPromoSummary({
      planId: result.planId,
      campaignName: result.campaignName,
      accessDurationDays: result.accessDurationDays,
      permanentAccess: result.permanentAccess,
      renewalBehavior: result.renewalBehavior
    })
  };
}

async function redeemPromoCodeSupabase(supabase, { code, email, userId, ipHash }) {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized || !email || !userId) {
    return { success: false, error: "invalid_request", message: publicPromoError("invalid_request") };
  }

  const precheck = await validatePromoCodeSupabase(supabase, { code: normalized, email, userId, ipHash });
  if (!precheck.valid) {
    return { success: false, error: precheck.error, message: precheck.message };
  }

  const { data, error } = await supabase.rpc("redeem_promo_code", {
    p_code_hash: await hashPromoCode(normalized),
    p_email: email,
    p_user_id: userId
  });

  if (error) {
    return { success: false, error: "server_error", message: publicPromoError("server_error") };
  }

  if (!data?.success) {
    const errorCode = data?.error || "server_error";
    return { success: false, error: errorCode, message: publicPromoError(errorCode) };
  }

  return {
    success: true,
    code: normalized,
    publicCode: data.publicCode || normalized,
    planId: data.planId,
    campaignName: data.campaignName,
    promotionStartsAt: data.promotionStartsAt,
    promotionEndsAt: data.promotionEndsAt,
    message: `Your complimentary ${promoPlanLabel(data.planId)} Plan has been activated.`,
    summary: buildPromoSummary({
      planId: data.planId,
      campaignName: data.campaignName,
      permanentAccess: data.permanentAccess,
      renewalBehavior: data.renewalBehavior,
      promotionEndsAt: data.promotionEndsAt
    })
  };
}

async function resolveRedeemUser(context, env, payload) {
  const request = context.request;
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) {
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
    if (payload.email && data.user.email?.toLowerCase() !== payload.email.toLowerCase()) {
      const mismatch = new Error("This promo code is not available for this account.");
      mismatch.statusCode = 403;
      throw mismatch;
    }
    return { userId: data.user.id, email: data.user.email };
  }

  if (payload.userId) {
    const supabase = createSupabaseAdmin(env);
    if (!supabase) {
      const error = new Error("Supabase is not configured.");
      error.statusCode = 503;
      throw error;
    }
    const { data, error } = await supabase.auth.admin.getUserById(payload.userId);
    if (error || !data?.user) {
      const authError = new Error("Authentication required.");
      authError.statusCode = 401;
      throw authError;
    }
    if (data.user.email?.toLowerCase() !== payload.email.toLowerCase()) {
      const mismatch = new Error("This promo code is not available for this account.");
      mismatch.statusCode = 403;
      throw mismatch;
    }
    const createdAt = new Date(data.user.created_at || 0).getTime();
    if (Date.now() - createdAt > 30 * 60 * 1000) {
      const authError = new Error("Authentication required.");
      authError.statusCode = 401;
      throw authError;
    }
    return { userId: data.user.id, email: data.user.email };
  }

  const authError = new Error("Authentication required.");
  authError.statusCode = 401;
  throw authError;
}

export async function handlePromoValidate(context) {
  const env = envFromContext(context);
  const supabase = createSupabaseAdmin(env);
  if (!supabase) {
    return json(
      {
        error: "promo_unavailable",
        message: "Promo codes are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      },
      503
    );
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  if (context.request.method !== "POST") {
    return json({ error: "method_not_allowed", message: "Method not allowed." }, 405);
  }

  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/promo/validate",
    VALIDATE_LIMIT,
    VALIDATE_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    const headers = rateLimitError.retryAfterSeconds
      ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
      : {};
    return json(
      { error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.statusCode,
      headers
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }

  const code = String(payload?.code || "").trim();
  const email = payload?.email ? String(payload.email).trim() : undefined;
  if (!code) {
    return json({ valid: false, error: "not_found", message: publicPromoError("not_found") });
  }

  const ipHash = hashClientIp(requestFromContext(context), env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");
  const result = await validatePromoCodeSupabase(supabase, { code, email, ipHash });

  return json(
    result.valid
      ? { valid: true, code: result.code, message: result.message, summary: result.summary }
      : { valid: false, error: result.error, message: result.message }
  );
}

export async function handlePromoRedeemAtSignup(context) {
  const env = envFromContext(context);
  const supabase = createSupabaseAdmin(env);
  if (!supabase) {
    return json(
      {
        error: "promo_unavailable",
        message: "Promo codes are not configured yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      },
      503
    );
  }

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  if (context.request.method !== "POST") {
    return json({ error: "method_not_allowed", message: "Method not allowed." }, 405);
  }

  const rateLimitError = enforceIpRateLimit(
    requestFromContext(context),
    "/api/promo/redeem-at-signup",
    REDEEM_LIMIT,
    REDEEM_WINDOW_SECONDS,
    env
  );
  if (rateLimitError) {
    const headers = rateLimitError.retryAfterSeconds
      ? { "Retry-After": String(rateLimitError.retryAfterSeconds) }
      : {};
    return json(
      { error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.statusCode,
      headers
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return json({ error: "validation_error", message: "Invalid request body." }, 400);
  }

  const code = String(payload?.code || "").trim();
  const email = String(payload?.email || "").trim();
  if (!code || !email) {
    return json({ success: false, error: "invalid_request", message: publicPromoError("invalid_request") }, 400);
  }

  try {
    const identity = await resolveRedeemUser(context, env, payload);
    const ipHash = hashClientIp(requestFromContext(context), env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");
    const result = await redeemPromoCodeSupabase(supabase, {
      code,
      email: identity.email,
      userId: identity.userId,
      ipHash
    });

    if (!result.success) {
      return json({ success: false, error: result.error, message: result.message }, 400);
    }

    return json({
      success: true,
      message: result.message,
      code: result.code,
      planId: result.planId,
      summary: result.summary,
      promotionStartsAt: result.promotionStartsAt,
      promotionEndsAt: result.promotionEndsAt,
      paymentPageBypassed: true
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return json(
      {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      },
      statusCode
    );
  }
}
