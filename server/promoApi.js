import { z } from "zod";
import { readJsonBody, sendJson, getRequestUrl } from "./http.js";
import { enforceIpRateLimit, hashClientIp } from "./lib/ipRateLimit.js";
import { validatePromoCode, redeemPromoCode } from "./lib/promoCodes.js";
import { deliverPromoWelcomeEmail } from "./lib/promoEmail.js";
import { requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import { db, requireAuth } from "./authApi.js";
import { getSupabaseAdmin } from "./lib/supabaseRequestAuth.js";

const VALIDATE_LIMIT = 20;
const VALIDATE_WINDOW_SECONDS = 15 * 60;
const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_SECONDS = 60 * 60;

const validateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(255).optional()
});

const redeemSchema = z.object({
  code: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(255),
  userId: z.string().uuid().optional()
});

function promoPaths(pathname) {
  return (
    pathname === "/api/promo/validate" ||
    pathname === "/api/promo/redeem" ||
    pathname === "/api/promo/redeem-at-signup"
  );
}

async function resolveRedeemUser(req, payload) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { user } = await requireSupabaseUser(req);
    if (payload.email && user.email?.toLowerCase() !== payload.email.toLowerCase()) {
      const error = new Error("This promo code is not available for this account.");
      error.statusCode = 403;
      error.code = "email_ineligible";
      throw error;
    }
    return { userId: user.id, email: user.email };
  }

  if (payload.userId) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase.auth.admin.getUserById(payload.userId);
      if (error || !data?.user) {
        const authError = new Error("Authentication required.");
        authError.statusCode = 401;
        throw authError;
      }
      if (data.user.email?.toLowerCase() !== payload.email.toLowerCase()) {
        const mismatch = new Error("This promo code is not available for this account.");
        mismatch.statusCode = 403;
        mismatch.code = "email_ineligible";
        throw mismatch;
      }
      const createdAt = new Date(data.user.created_at || 0).getTime();
      if (Date.now() - createdAt > 30 * 60 * 1000) {
        const expired = new Error("Authentication required.");
        expired.statusCode = 401;
        throw expired;
      }
      return { userId: data.user.id, email: data.user.email };
    }

    const prismaUser = await db().user.findUnique({ where: { id: payload.userId } });
    if (!prismaUser || prismaUser.email.toLowerCase() !== payload.email.toLowerCase()) {
      const authError = new Error("Authentication required.");
      authError.statusCode = 401;
      throw authError;
    }
    return { userId: prismaUser.id, email: prismaUser.email };
  }

  try {
    const auth = await requireAuth(req);
    return { userId: auth.user.id, email: auth.user.email };
  } catch {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }
}

async function handleValidate(req, res, env) {
  const rateLimitError = enforceIpRateLimit(req, "/api/promo/validate", VALIDATE_LIMIT, VALIDATE_WINDOW_SECONDS, env);
  if (rateLimitError) {
    return sendJson(
      res,
      rateLimitError.statusCode,
      { error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.retryAfterSeconds ? { "Retry-After": String(rateLimitError.retryAfterSeconds) } : undefined
    );
  }

  const payload = validateSchema.parse(await readJsonBody(req));
  const ipHash = hashClientIp(req, env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");
  const result = await validatePromoCode({
    code: payload.code,
    email: payload.email,
    ipHash
  });

  if (!result.valid) {
    return sendJson(res, 200, {
      valid: false,
      error: result.error,
      message: result.message
    });
  }

  return sendJson(res, 200, {
    valid: true,
    code: result.code,
    message: result.message,
    summary: result.summary
  });
}

async function handleRedeem(req, res, env, { allowSignup = false } = {}) {
  const route = allowSignup ? "/api/promo/redeem-at-signup" : "/api/promo/redeem";
  const rateLimitError = enforceIpRateLimit(req, route, REDEEM_LIMIT, REDEEM_WINDOW_SECONDS, env);
  if (rateLimitError) {
    return sendJson(
      res,
      rateLimitError.statusCode,
      { error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.retryAfterSeconds ? { "Retry-After": String(rateLimitError.retryAfterSeconds) } : undefined
    );
  }

  const payload = redeemSchema.parse(await readJsonBody(req));
  const identity = await resolveRedeemUser(req, payload);
  const ipHash = hashClientIp(req, env.RATE_LIMIT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "");

  const result = await redeemPromoCode({
    code: payload.code,
    email: identity.email,
    userId: identity.userId,
    ipHash
  });

  if (!result.success) {
    return sendJson(res, 400, {
      success: false,
      error: result.error,
      message: result.message
    });
  }

  await deliverPromoWelcomeEmail({
    to: identity.email,
    publicCode: result.publicCode,
    campaignName: result.campaignName,
    planId: result.planId,
    permanentAccess: result.summary?.permanentAccess,
    promotionEndsAt: result.promotionEndsAt,
    req,
    env
  });

  return sendJson(res, 200, {
    success: true,
    message: result.message,
    code: result.code,
    planId: result.planId,
    summary: result.summary,
    promotionStartsAt: result.promotionStartsAt,
    promotionEndsAt: result.promotionEndsAt,
    paymentPageBypassed: true
  });
}

export function createPromoApiMiddleware(env = process.env) {
  return async function promoApiMiddleware(req, res, next) {
    const url = getRequestUrl(req);
    if (!promoPaths(url.pathname)) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    if (req.method !== "POST") return next();

    try {
      if (url.pathname === "/api/promo/validate") return await handleValidate(req, res, env);
      if (url.pathname === "/api/promo/redeem") return await handleRedeem(req, res, env);
      if (url.pathname === "/api/promo/redeem-at-signup") return await handleRedeem(req, res, env, { allowSignup: true });
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-promo]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createPromoApiMiddleware();
export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
