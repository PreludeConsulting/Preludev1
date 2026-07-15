import { z } from "zod";
import { readJsonBody, sendJson, getRequestUrl } from "./http.js";
import { enforceIpRateLimit } from "./lib/ipRateLimit.js";
import { requireSupabaseUser, getSupabaseAdmin } from "./lib/supabaseRequestAuth.js";
import {
  associateReferralAtSignup,
  claimReferralReward,
  ensureReferralCodeForUser,
  findEligibleSubscriptionForHousehold,
  listHouseholdRewards,
  publicReferralError,
  validateReferralCodeForSignup
} from "./lib/referralCodes.js";
import Stripe from "stripe";
import { getOrCreateReferralCoupon, scheduleReferralDiscountOnSubscription } from "./lib/referralStripe.js";
import { getBillingConfig, STRIPE_API_VERSION } from "./billingConfig.js";
import { logReferralEvent } from "../shared/referralConstants.js";

function getStripeClient(config = getBillingConfig()) {
  return new Stripe(config.stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
}

const VALIDATE_LIMIT = 20;
const VALIDATE_WINDOW_SECONDS = 15 * 60;

const validateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  role: z.string().trim().min(1).max(32).optional(),
  email: z.string().trim().email().max(255).optional()
});

const associateSchema = z.object({
  code: z.string().trim().min(1).max(64),
  role: z.string().trim().min(1).max(32),
  email: z.string().trim().email().max(255).optional(),
  userId: z.string().uuid().optional()
});

const claimSchema = z.object({
  rewardId: z.string().uuid()
});

function referralPaths(pathname) {
  return (
    pathname === "/api/referral/code" ||
    pathname === "/api/referral/validate" ||
    pathname === "/api/referral/associate" ||
    pathname === "/api/referral/rewards" ||
    pathname === "/api/referral/claim"
  );
}

async function handleGetCode(req, res) {
  const { user } = await requireSupabaseUser(req);
  const result = await ensureReferralCodeForUser(user.id);
  return sendJson(res, 200, result);
}

async function handleValidate(req, res, env) {
  const rateLimitError = enforceIpRateLimit(req, "/api/referral/validate", VALIDATE_LIMIT, VALIDATE_WINDOW_SECONDS, env);
  if (rateLimitError) {
    return sendJson(
      res,
      rateLimitError.statusCode,
      { valid: false, error: rateLimitError.code, message: rateLimitError.message },
      rateLimitError.retryAfterSeconds ? { "Retry-After": String(rateLimitError.retryAfterSeconds) } : undefined
    );
  }

  const payload = validateSchema.parse(await readJsonBody(req));
  let userId = null;
  try {
    const auth = await requireSupabaseUser(req);
    userId = auth.user.id;
  } catch {
    /* public validate allowed */
  }

  const result = await validateReferralCodeForSignup({
    code: payload.code,
    role: payload.role,
    email: payload.email,
    userId
  });

  logReferralEvent("referral_code_submitted_validate", {
    valid: Boolean(result.valid),
    error: result.error || null,
    userId
  });

  return sendJson(res, 200, {
    valid: Boolean(result.valid),
    code: result.code || null,
    message: result.message,
    error: result.error || null,
    discountPercent: result.discountPercent || null
  });
}

async function resolveAssociateUser(req, payload) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const { user } = await requireSupabaseUser(req);
    return { userId: user.id, email: user.email, role: payload.role || user.user_metadata?.role };
  }
  if (payload.userId && payload.email) {
    const supabase = getSupabaseAdmin();
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
    if (data.user.email?.toLowerCase() !== payload.email.toLowerCase()) {
      const mismatch = new Error("This referral code is not available for this account.");
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
    return { userId: data.user.id, email: data.user.email, role: payload.role };
  }
  const error = new Error("Authentication required.");
  error.statusCode = 401;
  throw error;
}

async function handleAssociate(req, res) {
  const payload = associateSchema.parse(await readJsonBody(req));
  const identity = await resolveAssociateUser(req, payload);
  const result = await associateReferralAtSignup({
    code: payload.code,
    userId: identity.userId,
    role: identity.role,
    email: payload.email || identity.email
  });
  if (!result.success) {
    return sendJson(res, 400, result);
  }
  return sendJson(res, 200, result);
}

async function handleListRewards(req, res) {
  const { user } = await requireSupabaseUser(req);
  const result = await listHouseholdRewards(user.id);
  return sendJson(res, 200, result);
}

async function subscriptionLookup(userId, householdId) {
  const supabase = getSupabaseAdmin();
  const profile = await findEligibleSubscriptionForHousehold(supabase, householdId, userId);
  if (!profile) {
    return { eligible: false };
  }

  const config = getBillingConfig();
  if (!config.enabled) {
    return {
      eligible: true,
      subscriptionId: profile.stripe_subscription_id,
      currentPeriodEnd: null,
      profileId: profile.id
    };
  }

  const stripe = getStripeClient(config);
  const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
  const status = String(subscription.status || "").toLowerCase();
  if (!["active", "trialing"].includes(status) || status === "canceled" || status === "unpaid" || status === "past_due") {
    // trialing/active only; past_due explicitly ineligible
    if (status === "past_due" || status === "unpaid" || status === "canceled" || status === "incomplete") {
      return { eligible: false, reason: status };
    }
  }
  if (!["active", "trialing"].includes(status)) {
    return { eligible: false, reason: status };
  }

  return {
    eligible: true,
    subscriptionId: subscription.id,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null,
    profileId: profile.id,
    status
  };
}

async function handleClaim(req, res) {
  const { user } = await requireSupabaseUser(req);
  const payload = claimSchema.parse(await readJsonBody(req));
  const config = getBillingConfig();

  const result = await claimReferralReward({
    userId: user.id,
    rewardId: payload.rewardId,
    subscriptionLookup,
    applyDiscountFn: async ({ reward, subscription }) => {
      if (!config.enabled) {
        const error = new Error("Billing is not configured.");
        error.statusCode = 503;
        error.code = "billing_not_configured";
        throw error;
      }
      const stripe = getStripeClient(config);
      const couponId = await getOrCreateReferralCoupon(stripe);
      await scheduleReferralDiscountOnSubscription(stripe, subscription.subscriptionId, couponId, {
        referralRewardId: reward.id
      });
      return {
        couponId,
        appliesOn: subscription.currentPeriodEnd || null,
        scheduledInvoiceId: null
      };
    }
  });

  if (!result.success) {
    const status =
      result.error === "claim_cutoff"
        ? 409
        : result.error === "claim_race" || result.error === "reward_already_claimed"
          ? 409
          : 400;
    return sendJson(res, status, result);
  }
  return sendJson(res, 200, result);
}

export function createReferralApiMiddleware(env = process.env) {
  return async function referralApiMiddleware(req, res, next) {
    const url = getRequestUrl(req);
    if (!referralPaths(url.pathname)) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      if (url.pathname === "/api/referral/code" && req.method === "GET") return await handleGetCode(req, res);
      if (url.pathname === "/api/referral/validate" && req.method === "POST") {
        return await handleValidate(req, res, env);
      }
      if (url.pathname === "/api/referral/associate" && req.method === "POST") {
        return await handleAssociate(req, res);
      }
      if (url.pathname === "/api/referral/rewards" && req.method === "GET") {
        return await handleListRewards(req, res);
      }
      if (url.pathname === "/api/referral/claim" && req.method === "POST") {
        return await handleClaim(req, res);
      }
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-referral]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || publicReferralError("server_error")
      });
    }
  };
}

const middleware = createReferralApiMiddleware();
export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
