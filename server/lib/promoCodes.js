import { createHash, randomBytes } from "node:crypto";
import {
  PROMO_CODE_PATTERN,
  PROMO_ERROR_MESSAGES,
  normalizePromoCodeInput,
  publicPromoError
} from "../../shared/promoCodeConstants.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";
import { db } from "../authApi.js";

export { normalizePromoCodeInput, publicPromoError };

export function isValidPromoCodeFormat(code) {
  return PROMO_CODE_PATTERN.test(code);
}

export function hashPromoCode(code) {
  return createHash("sha256").update(normalizePromoCodeInput(code)).digest("hex");
}

export function buildPromoSummary(validation) {
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

  return {
    plan: "Basic",
    planId: validation.planId || "basic",
    priceToday: "$0.00",
    paymentMethodRequired: false,
    accessPeriod,
    renewalTerms,
    campaignName: validation.campaignName || null,
    permanentAccess: permanent,
    promotionEndsAt: validation.promotionEndsAt || null
  };
}

async function logValidationAttempt({ codeHash, email, ipHash, success, errorCode, usePrisma = false }) {
  const row = {
    codeHash: codeHash || null,
    email: email ? email.toLowerCase() : null,
    ipHash: ipHash || null,
    success: Boolean(success),
    errorCode: errorCode || null
  };

  if (usePrisma) {
    await db().promoValidationAttempt.create({ data: row });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  await supabase.from("promo_validation_attempts").insert({
    code_hash: row.codeHash,
    email: row.email,
    ip_hash: row.ipHash,
    success: row.success,
    error_code: row.errorCode
  });
}

async function validateWithSupabase(codeHash, email, userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error(PROMO_ERROR_MESSAGES.server_error);
    error.code = "server_error";
    throw error;
  }

  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code_hash: codeHash,
    p_email: email || null,
    p_user_id: userId || null
  });

  if (error) {
    const err = new Error(PROMO_ERROR_MESSAGES.server_error);
    err.code = "server_error";
    throw err;
  }

  return data || { valid: false, error: "server_error" };
}

async function validateWithPrisma(codeHash, email, userId) {
  const promo = await db().promoCode.findUnique({ where: { codeHash } });
  if (!promo) return { valid: false, error: "not_found" };
  if (!promo.active || promo.revokedAt) return { valid: false, error: "inactive" };
  if (promo.startsAt && promo.startsAt > new Date()) return { valid: false, error: "not_started" };
  if (promo.expiresAt && promo.expiresAt <= new Date()) return { valid: false, error: "expired" };
  if (promo.singleUse && promo.currentRedemptionCount >= 1) return { valid: false, error: "already_redeemed" };
  if (promo.maxRedemptions != null && promo.currentRedemptionCount >= promo.maxRedemptions) {
    return { valid: false, error: "redemption_limit_reached" };
  }
  if (promo.applicablePlan !== "basic") return { valid: false, error: "wrong_plan" };

  const normalizedEmail = email?.toLowerCase() || null;
  if (normalizedEmail && promo.eligibleEmails.length > 0) {
    const allowed = promo.eligibleEmails.map((value) => value.toLowerCase());
    if (!allowed.includes(normalizedEmail)) return { valid: false, error: "email_ineligible" };
  }
  if (normalizedEmail && promo.eligibleEmailDomains.length > 0) {
    const domain = normalizedEmail.split("@")[1] || "";
    if (!promo.eligibleEmailDomains.includes(domain)) return { valid: false, error: "email_ineligible" };
  }
  if (promo.newUsersOnly && normalizedEmail && !userId) {
    const existing = await db().user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
    if (existing) return { valid: false, error: "email_ineligible" };
  }
  if (userId) {
    const userRedemptions = await db().promoRedemption.count({
      where: { promoCodeId: promo.id, userId }
    });
    if (userRedemptions >= promo.maxRedemptionsPerUser) return { valid: false, error: "email_ineligible" };
  }

  return {
    valid: true,
    promoCodeId: promo.id,
    publicCode: promo.publicCode,
    planId: promo.applicablePlan,
    campaignName: promo.campaignName,
    discountType: promo.discountType,
    accessDurationDays: promo.accessDurationDays,
    renewalBehavior: promo.renewalBehavior,
    permanentAccess: promo.accessDurationDays == null
  };
}

export async function validatePromoCode({ code, email, userId, ipHash, backend = "auto" }) {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized) {
    return { valid: false, error: "not_found", message: publicPromoError("not_found") };
  }
  if (!isValidPromoCodeFormat(normalized)) {
    return { valid: false, error: "invalid_code_format", message: publicPromoError("invalid_code_format") };
  }

  const codeHash = hashPromoCode(normalized);
  const usePrisma = backend === "prisma" || (backend === "auto" && !getSupabaseAdmin());
  let result;

  try {
    result = usePrisma
      ? await validateWithPrisma(codeHash, email, userId)
      : await validateWithSupabase(codeHash, email, userId);
  } catch (error) {
    await logValidationAttempt({ codeHash, email, ipHash, success: false, errorCode: "server_error", usePrisma });
    throw error;
  }

  const valid = Boolean(result.valid);
  const errorCode = valid ? null : result.error || "not_found";
  await logValidationAttempt({ codeHash, email, ipHash, success: valid, errorCode, usePrisma });

  if (!valid) {
    return {
      valid: false,
      error: errorCode,
      message: publicPromoError(errorCode)
    };
  }

  const summary = buildPromoSummary(result);
  return {
    valid: true,
    code: normalized,
    promoCodeId: result.promoCodeId,
    publicCode: result.publicCode || normalized,
    summary,
    message: "Promo code applied successfully"
  };
}

async function redeemWithSupabase(codeHash, email, userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error(PROMO_ERROR_MESSAGES.server_error);
    error.code = "server_error";
    throw error;
  }

  const { data, error } = await supabase.rpc("redeem_promo_code", {
    p_code_hash: codeHash,
    p_email: email,
    p_user_id: userId
  });

  if (error) {
    const err = new Error(PROMO_ERROR_MESSAGES.server_error);
    err.code = "server_error";
    throw err;
  }

  return data || { success: false, error: "server_error" };
}

async function redeemWithPrisma(codeHash, email, userId) {
  return db().$transaction(async (tx) => {
    const validation = await validateWithPrisma(codeHash, email, userId);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const promo = await tx.promoCode.findUnique({ where: { codeHash } });
    if (!promo) return { success: false, error: "not_found" };

    const promotionEndsAt = promo.accessDurationDays
      ? new Date(Date.now() + promo.accessDurationDays * 24 * 60 * 60 * 1000)
      : null;

    const redemption = await tx.promoRedemption.create({
      data: {
        promoCodeId: promo.id,
        userId,
        email: email.toLowerCase(),
        planId: promo.applicablePlan,
        promotionEndsAt,
        paymentWaived: true,
        campaignName: promo.campaignName
      }
    });

    await tx.promoCode.update({
      where: { id: promo.id },
      data: { currentRedemptionCount: { increment: 1 } }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        plan: "BASIC",
        subscriptionStatus: "promotional",
        subscriptionCurrentPeriodEnd: promotionEndsAt
      }
    });

    return {
      success: true,
      redemptionId: redemption.id,
      promoCodeId: promo.id,
      publicCode: promo.publicCode,
      planId: promo.applicablePlan,
      campaignName: promo.campaignName,
      promotionStartsAt: redemption.promotionStartsAt,
      promotionEndsAt,
      permanentAccess: promo.accessDurationDays == null,
      renewalBehavior: promo.renewalBehavior
    };
  });
}

export async function redeemPromoCode({ code, email, userId, ipHash, backend = "auto" }) {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized || !email || !userId) {
    return { success: false, error: "invalid_request", message: publicPromoError("invalid_request") };
  }
  if (!isValidPromoCodeFormat(normalized)) {
    return { success: false, error: "invalid_code_format", message: publicPromoError("invalid_code_format") };
  }

  const codeHash = hashPromoCode(normalized);
  const usePrisma = backend === "prisma" || (backend === "auto" && !getSupabaseAdmin());

  const precheck = await validatePromoCode({ code: normalized, email, userId, ipHash, backend: usePrisma ? "prisma" : "supabase" });
  if (!precheck.valid) {
    return { success: false, error: precheck.error, message: precheck.message };
  }

  let result;
  try {
    result = usePrisma
      ? await redeemWithPrisma(codeHash, email, userId)
      : await redeemWithSupabase(codeHash, email, userId);
  } catch (error) {
    if (error.code === "P2002") {
      return { success: false, error: "already_redeemed", message: publicPromoError("already_redeemed") };
    }
    throw error;
  }

  if (!result?.success) {
    const errorCode = result?.error || "server_error";
    return { success: false, error: errorCode, message: publicPromoError(errorCode) };
  }

  const summary = buildPromoSummary({
    planId: result.planId,
    campaignName: result.campaignName,
    accessDurationDays: result.permanentAccess ? null : undefined,
    permanentAccess: result.permanentAccess,
    renewalBehavior: result.renewalBehavior,
    promotionEndsAt: result.promotionEndsAt
  });

  return {
    success: true,
    code: normalized,
    redemptionId: result.redemptionId,
    promoCodeId: result.promoCodeId,
    publicCode: result.publicCode || normalized,
    planId: result.planId,
    campaignName: result.campaignName,
    promotionStartsAt: result.promotionStartsAt,
    promotionEndsAt: result.promotionEndsAt,
    summary,
    message: "Your complimentary Basic Plan has been activated."
  };
}

export function generatePromoCode(prefix = "BASIC") {
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 4);
  return `${prefix}-${suffix}`;
}
