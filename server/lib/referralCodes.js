import { randomBytes } from "node:crypto";
import {
  REFERRAL_CLAIM_LEAD_DAYS,
  REFERRAL_CODE_PATTERN,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_ERROR_MESSAGES,
  REFERRAL_REWARD_NOTIFICATION,
  isReferralEligibleRole,
  logReferralEvent,
  normalizeReferralCodeInput,
  publicReferralError
} from "../../shared/referralConstants.js";
import { getSupabaseAdmin } from "./supabaseRequestAuth.js";

export {
  normalizeReferralCodeInput,
  publicReferralError,
  isReferralEligibleRole,
  REFERRAL_DISCOUNT_PERCENT,
  REFERRAL_CLAIM_LEAD_DAYS
};

const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidReferralCodeFormat(code) {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCodeInput(code));
}

export function nameSlugFromProfile(fullName, preferredName) {
  const source = String(preferredName || fullName || "FRIEND").trim() || "FRIEND";
  const first = source.split(/\s+/)[0] || "FRIEND";
  const cleaned = first.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned.length >= 2 ? cleaned : "FRIEND").slice(0, 12);
}

export function generateReferralCodeCandidate(seedName) {
  const slug = nameSlugFromProfile(seedName);
  let suffix = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i += 1) {
    suffix += SUFFIX_ALPHABET[bytes[i] % SUFFIX_ALPHABET.length];
  }
  return `${slug}-${suffix}`;
}

function admin() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error(REFERRAL_ERROR_MESSAGES.server_error);
    error.code = "server_error";
    throw error;
  }
  return supabase;
}

function fail(code, extra = {}) {
  return {
    ok: false,
    valid: false,
    success: false,
    error: code,
    message: publicReferralError(code),
    ...extra
  };
}

export function msUntilPeriodEnd(periodEnd) {
  if (!periodEnd) return null;
  const end = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
  if (Number.isNaN(end.getTime())) return null;
  return end.getTime() - Date.now();
}

export function isWithinClaimCutoff(periodEnd, leadDays = REFERRAL_CLAIM_LEAD_DAYS) {
  const ms = msUntilPeriodEnd(periodEnd);
  if (ms == null) return true;
  return ms < leadDays * 24 * 60 * 60 * 1000;
}

export function canClaimForNextInvoice(periodEnd, leadDays = REFERRAL_CLAIM_LEAD_DAYS) {
  const ms = msUntilPeriodEnd(periodEnd);
  if (ms == null) return { ok: false, reason: "subscription_ineligible" };
  if (ms < leadDays * 24 * 60 * 60 * 1000) {
    return { ok: false, reason: "claim_cutoff" };
  }
  return { ok: true };
}

/** Pure helper for tests: normalize + format checks. */
export function normalizeAndValidateFormat(raw) {
  const normalized = normalizeReferralCodeInput(raw);
  if (!normalized) return { ok: false, error: "invalid_request" };
  if (!isValidReferralCodeFormat(normalized)) return { ok: false, error: "invalid_code_format", normalized };
  return { ok: true, normalized };
}

export async function ensureHouseholdForUser(userId) {
  const supabase = admin();
  const { data, error } = await supabase.rpc("ensure_household_for_user", { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function ensureReferralCodeForUser(userId) {
  const supabase = admin();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name, preferred_name, household_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    return fail("invalid_request");
  }
  if (!isReferralEligibleRole(profile.role)) {
    logReferralEvent("referral_code_view_denied", { userId, role: profile.role });
    return { ok: true, eligible: false, error: "role_ineligible", message: publicReferralError("role_ineligible") };
  }

  const householdId = await ensureHouseholdForUser(userId);
  if (!householdId) {
    return { ok: true, eligible: false, error: "role_ineligible", message: publicReferralError("role_ineligible") };
  }

  const seed = profile.preferred_name || profile.full_name || "FRIEND";
  const { data: codeRow, error: codeError } = await supabase.rpc("ensure_referral_code_for_household", {
    p_household_id: householdId,
    p_seed_name: seed
  });
  if (codeError) throw codeError;

  logReferralEvent("referral_code_viewed", { userId, householdId });
  return {
    ok: true,
    eligible: true,
    code: codeRow.code,
    normalizedCode: codeRow.normalized_code,
    status: codeRow.status,
    householdId
  };
}

export async function getReferralCodeByNormalized(normalized) {
  const supabase = admin();
  const { data, error } = await supabase
    .from("referral_codes")
    .select("id, household_id, code, normalized_code, status")
    .eq("normalized_code", normalized)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function validateReferralCode({
  code,
  role,
  userId = null,
  email = null
}) {
  const format = normalizeAndValidateFormat(code);
  if (!format.ok) {
    logReferralEvent("referral_validation_failed", { error: format.error, userId });
    return fail(format.error);
  }

  const normalizedRole = String(role || "").toLowerCase();
  if (normalizedRole === "mentor") {
    logReferralEvent("referral_validation_failed", { error: "mentor_ineligible", userId });
    return fail("mentor_ineligible");
  }
  if (normalizedRole && !isReferralEligibleRole(normalizedRole)) {
    logReferralEvent("referral_validation_failed", { error: "role_ineligible", userId });
    return fail("role_ineligible");
  }

  const codeRow = await getReferralCodeByNormalized(format.normalized);
  if (!codeRow) {
    logReferralEvent("referral_validation_failed", { error: "not_found", userId });
    return fail("not_found");
  }
  if (codeRow.status !== "active") {
    logReferralEvent("referral_validation_failed", { error: "disabled", userId });
    return fail("disabled");
  }

  if (userId) {
    const householdId = await ensureHouseholdForUser(userId);
    if (householdId && householdId === codeRow.household_id) {
      logReferralEvent("referral_validation_failed", { error: "self_referral", userId });
      return fail("self_referral");
    }

    const supabase = admin();
    const { data: prior } = await supabase
      .from("referrals")
      .select("id, status")
      .eq("referred_user_id", userId)
      .in("status", ["entered", "pending_account", "pending_payment", "confirmed"])
      .maybeSingle();
    if (prior) {
      return fail("already_referred");
    }

    if (householdId) {
      const { data: householdPrior } = await supabase
        .from("referrals")
        .select("id")
        .eq("referred_household_id", householdId)
        .eq("status", "confirmed")
        .maybeSingle();
      if (householdPrior) {
        return fail("household_already_referred");
      }
    }
  }

  logReferralEvent("referral_validation_succeeded", {
    userId,
    referralCodeId: codeRow.id,
    role: normalizedRole || null
  });

  return {
    ok: true,
    valid: true,
    code: codeRow.code,
    normalizedCode: codeRow.normalized_code,
    referralCodeId: codeRow.id,
    referrerHouseholdId: codeRow.household_id,
    message: "Referral code looks good. You’ll get 20% off your first monthly payment.",
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
    email: email || null
  };
}

export async function validateReferralCodeForSignup(args) {
  const result = await validateReferralCode(args);
  if (result.valid) {
    result.message =
      "Referral code applied. You’ll receive 20% off your first monthly subscription payment.";
  }
  return result;
}

export async function associateReferralAtSignup({
  code,
  userId,
  role,
  email = null
}) {
  const validation = await validateReferralCodeForSignup({ code, role, userId, email });
  if (!validation.valid) {
    return { success: false, ...validation };
  }

  const supabase = admin();

  // Mutual exclusion: one signup benefit only (promo OR referral).
  const { data: existingPromo } = await supabase
    .from("promo_redemptions")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existingPromo) {
    return fail("benefit_already_applied");
  }

  const householdId = await ensureHouseholdForUser(userId);

  const { data: referral, error } = await supabase
    .from("referrals")
    .insert({
      referral_code_id: validation.referralCodeId,
      referrer_household_id: validation.referrerHouseholdId,
      referred_household_id: householdId,
      referred_user_id: userId,
      status: "pending_payment",
      metadata: email ? { emailDomain: String(email).split("@")[1] || null } : {}
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("already_referred");
    }
    throw error;
  }

  await supabase.from("profiles").update({ pending_referral_id: referral.id }).eq("id", userId);

  logReferralEvent("referral_code_submitted", {
    userId,
    referralId: referral.id,
    referralCodeId: validation.referralCodeId
  });

  return {
    success: true,
    referralId: referral.id,
    code: validation.code,
    discountPercent: REFERRAL_DISCOUNT_PERCENT,
    message: validation.message
  };
}

export async function getPendingReferralForUser(userId) {
  const supabase = admin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("pending_referral_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.pending_referral_id) return null;

  const { data: referral } = await supabase
    .from("referrals")
    .select("id, status, referral_code_id, referrer_household_id, referred_household_id, referred_user_id")
    .eq("id", profile.pending_referral_id)
    .maybeSingle();

  if (!referral || !["entered", "pending_account", "pending_payment"].includes(referral.status)) {
    return null;
  }
  return referral;
}

/**
 * Confirm referral after first qualifying paid invoice.
 * Idempotent on qualifyingPaymentId.
 */
export async function confirmReferralFromPayment({
  userId,
  subscriptionId,
  qualifyingPaymentId,
  invoiceId = null
}) {
  if (!userId || !qualifyingPaymentId) {
    return { confirmed: false, reason: "missing_ids" };
  }

  const supabase = admin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, pending_referral_id, household_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !isReferralEligibleRole(profile.role)) {
    return { confirmed: false, reason: "role_ineligible" };
  }

  // Idempotency: payment already confirmed a referral
  const { data: byPayment } = await supabase
    .from("referrals")
    .select("*")
    .eq("qualifying_payment_id", qualifyingPaymentId)
    .maybeSingle();
  if (byPayment) {
    return { confirmed: true, duplicate: true, referral: byPayment };
  }

  let referral = null;
  if (profile.pending_referral_id) {
    const { data } = await supabase
      .from("referrals")
      .select("*")
      .eq("id", profile.pending_referral_id)
      .maybeSingle();
    referral = data;
  }
  if (!referral) {
    const { data } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_user_id", userId)
      .in("status", ["entered", "pending_account", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    referral = data;
  }

  if (!referral) {
    return { confirmed: false, reason: "no_pending_referral" };
  }
  if (referral.status === "confirmed") {
    return { confirmed: true, duplicate: true, referral };
  }
  if (!["entered", "pending_account", "pending_payment"].includes(referral.status)) {
    return { confirmed: false, reason: "invalid_status", referral };
  }

  const referredHouseholdId = referral.referred_household_id || (await ensureHouseholdForUser(userId));

  const { data: updated, error: updateError } = await supabase
    .from("referrals")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      qualifying_payment_id: qualifyingPaymentId,
      referred_subscription_id: subscriptionId || referral.referred_subscription_id,
      referred_household_id: referredHouseholdId,
      metadata: {
        ...(referral.metadata || {}),
        invoiceId: invoiceId || null
      }
    })
    .eq("id", referral.id)
    .in("status", ["entered", "pending_account", "pending_payment"])
    .select("*")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23505") {
      const { data: race } = await supabase
        .from("referrals")
        .select("*")
        .eq("qualifying_payment_id", qualifyingPaymentId)
        .maybeSingle();
      return { confirmed: true, duplicate: true, referral: race };
    }
    throw updateError;
  }
  if (!updated) {
    const { data: current } = await supabase.from("referrals").select("*").eq("id", referral.id).maybeSingle();
    if (current?.status === "confirmed") {
      return { confirmed: true, duplicate: true, referral: current };
    }
    return { confirmed: false, reason: "update_lost_race" };
  }

  await supabase.from("profiles").update({ pending_referral_id: null }).eq("id", userId);

  const reward = await createReferrerReward(updated);
  logReferralEvent("referral_payment_confirmed", {
    referralId: updated.id,
    userId,
    qualifyingPaymentId,
    rewardId: reward?.id || null
  });

  return { confirmed: true, duplicate: false, referral: updated, reward };
}

async function createReferrerReward(referral) {
  const supabase = admin();
  const { data: existing } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referral_id", referral.id)
    .maybeSingle();
  if (existing) return existing;

  const { data: reward, error } = await supabase
    .from("referral_rewards")
    .insert({
      referral_id: referral.id,
      household_id: referral.referrer_household_id,
      status: "available",
      discount_percent: REFERRAL_DISCOUNT_PERCENT,
      available_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data } = await supabase
        .from("referral_rewards")
        .select("*")
        .eq("referral_id", referral.id)
        .maybeSingle();
      return data;
    }
    throw error;
  }

  const notificationIds = await notifyHouseholdReward(reward);
  if (notificationIds.length) {
    await supabase
      .from("referral_rewards")
      .update({ notification_ids: notificationIds, updated_at: new Date().toISOString() })
      .eq("id", reward.id);
  }

  logReferralEvent("referrer_reward_created", {
    rewardId: reward.id,
    householdId: reward.household_id,
    referralId: referral.id
  });

  return reward;
}

async function notifyHouseholdReward(reward) {
  const supabase = admin();
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", reward.household_id);

  const ids = [];
  for (const member of members || []) {
    const { data: notification } = await supabase
      .from("notifications")
      .insert({
        user_id: member.user_id,
        title: REFERRAL_REWARD_NOTIFICATION.title,
        body: REFERRAL_REWARD_NOTIFICATION.body,
        link: null,
        unread: true,
        action_type: "claim_referral_reward",
        action_payload: { rewardId: reward.id, householdId: reward.household_id }
      })
      .select("id")
      .single();
    if (notification?.id) ids.push(notification.id);
  }
  return ids;
}

export async function listHouseholdRewards(userId) {
  const supabase = admin();
  const { data: profile } = await supabase.from("profiles").select("role, household_id").eq("id", userId).maybeSingle();
  if (!profile || !isReferralEligibleRole(profile.role)) {
    return { eligible: false, rewards: [] };
  }
  const householdId = profile.household_id || (await ensureHouseholdForUser(userId));
  const { data: rewards, error } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { eligible: true, householdId, rewards: rewards || [] };
}

/**
 * Claim a household reward. Server validates subscription + 7-day cutoff.
 * applyDiscountFn({ subscriptionId, reward, userId }) should attach Stripe coupon.
 */
export async function claimReferralReward({
  userId,
  rewardId,
  subscriptionLookup,
  applyDiscountFn
}) {
  const supabase = admin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, household_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !isReferralEligibleRole(profile.role)) {
    return fail("role_ineligible");
  }

  const householdId = profile.household_id || (await ensureHouseholdForUser(userId));

  const { data: reward, error: rewardError } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (rewardError) throw rewardError;
  if (!reward) return fail("reward_unavailable");
  if (["claimed", "scheduled", "applied"].includes(reward.status)) {
    logReferralEvent("reward_claim_failed", { rewardId, error: "reward_already_claimed", userId });
    return fail("reward_already_claimed");
  }
  if (reward.status !== "available") {
    return fail("reward_unavailable");
  }

  const { data: inflight } = await supabase
    .from("referral_rewards")
    .select("id")
    .eq("household_id", householdId)
    .in("status", ["claimed", "scheduled"])
    .neq("id", rewardId)
    .maybeSingle();
  if (inflight) {
    return {
      ...fail("reward_unavailable"),
      message:
        "Another referral reward is already scheduled for your next payment. Additional rewards stay queued for later billing cycles."
    };
  }

  const subscription = await subscriptionLookup(userId, householdId);
  if (!subscription?.eligible || !subscription.subscriptionId) {
    logReferralEvent("reward_claim_failed", { rewardId, error: "subscription_ineligible", userId });
    return fail("subscription_ineligible");
  }

  const cutoff = canClaimForNextInvoice(subscription.currentPeriodEnd);
  if (!cutoff.ok) {
    logReferralEvent("reward_claim_failed", { rewardId, error: cutoff.reason, userId });
    return fail(cutoff.reason, {
      currentPeriodEnd: subscription.currentPeriodEnd || null,
      remainsAvailable: true
    });
  }

  const { data: claimed, error: claimError } = await supabase
    .from("referral_rewards")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_by_user_id: userId,
      scheduled_billing_period: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString()
        : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", rewardId)
    .eq("status", "available")
    .select("*")
    .maybeSingle();

  if (claimError) {
    if (claimError.code === "23505") {
      logReferralEvent("reward_claim_failed", { rewardId, error: "claim_race", userId });
      return fail("claim_race");
    }
    throw claimError;
  }
  if (!claimed) {
    logReferralEvent("reward_claim_failed", { rewardId, error: "claim_race", userId });
    return fail("claim_race");
  }

  let applyResult;
  try {
    applyResult = await applyDiscountFn({
      userId,
      householdId,
      reward: claimed,
      subscription
    });
  } catch (error) {
    await supabase
      .from("referral_rewards")
      .update({ status: "available", claimed_at: null, claimed_by_user_id: null, updated_at: new Date().toISOString() })
      .eq("id", rewardId);
    throw error;
  }

  const scheduled = await supabase
    .from("referral_rewards")
    .update({
      status: "scheduled",
      stripe_coupon_id: applyResult?.couponId || claimed.stripe_coupon_id,
      scheduled_invoice_id: applyResult?.scheduledInvoiceId || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", rewardId)
    .select("*")
    .single();

  await markRewardNotificationsClaimed(rewardId, applyResult?.appliesOn || claimed.scheduled_billing_period);

  logReferralEvent("reward_claim_succeeded", { rewardId, userId, householdId });
  logReferralEvent("reward_scheduled", {
    rewardId,
    appliesOn: applyResult?.appliesOn || null,
    couponId: applyResult?.couponId || null
  });

  return {
    success: true,
    ok: true,
    reward: scheduled.data || claimed,
    appliesOn: applyResult?.appliesOn || claimed.scheduled_billing_period,
    message: applyResult?.appliesOn
      ? `Reward claimed. Your 20% discount is scheduled for your payment on ${new Date(applyResult.appliesOn).toLocaleDateString()}.`
      : "Reward claimed. Your 20% discount will apply to your next eligible monthly payment."
  };
}

async function markRewardNotificationsClaimed(rewardId, appliesOn) {
  const supabase = admin();
  const { data: reward } = await supabase
    .from("referral_rewards")
    .select("notification_ids")
    .eq("id", rewardId)
    .maybeSingle();
  const ids = reward?.notification_ids || [];
  if (!ids.length) {
    // Fallback: match by action payload
    await supabase
      .from("notifications")
      .update({
        action_completed_at: new Date().toISOString(),
        body: appliesOn
          ? `${REFERRAL_REWARD_NOTIFICATION.body}\n\nClaimed — discount expected on ${new Date(appliesOn).toLocaleDateString()}.`
          : `${REFERRAL_REWARD_NOTIFICATION.body}\n\nClaimed — discount will apply to your next eligible payment.`,
        unread: false
      })
      .contains("action_payload", { rewardId });
    return;
  }
  await supabase
    .from("notifications")
    .update({
      action_completed_at: new Date().toISOString(),
      body: appliesOn
        ? `${REFERRAL_REWARD_NOTIFICATION.body}\n\nClaimed — discount expected on ${new Date(appliesOn).toLocaleDateString()}.`
        : `${REFERRAL_REWARD_NOTIFICATION.body}\n\nClaimed — discount will apply to your next eligible payment.`,
      unread: false
    })
    .in("id", ids);
}

export async function markRewardApplied({ rewardId, invoiceId }) {
  const supabase = admin();
  const { data, error } = await supabase
    .from("referral_rewards")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
      applied_invoice_id: invoiceId || null,
      updated_at: new Date().toISOString()
    })
    .eq("id", rewardId)
    .in("status", ["claimed", "scheduled"])
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (data) logReferralEvent("reward_applied", { rewardId, invoiceId });
  return data;
}

export async function markRewardAppliedBySubscription({ subscriptionId, invoiceId, householdId }) {
  const supabase = admin();
  let query = supabase
    .from("referral_rewards")
    .select("*")
    .in("status", ["claimed", "scheduled"])
    .order("claimed_at", { ascending: true })
    .limit(1);
  if (householdId) query = query.eq("household_id", householdId);
  const { data: rewards } = await query;
  const reward = rewards?.[0];
  if (!reward) return null;
  return markRewardApplied({ rewardId: reward.id, invoiceId });
}

export async function revokeRewardsForQualifyingPayment(qualifyingPaymentId, reason = "payment_reversed") {
  const supabase = admin();
  const { data: referral } = await supabase
    .from("referrals")
    .select("id, referrer_household_id")
    .eq("qualifying_payment_id", qualifyingPaymentId)
    .maybeSingle();
  if (!referral) return { revoked: 0 };

  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("referral_id", referral.id)
    .in("status", ["available", "claimed", "scheduled"]);

  let revoked = 0;
  for (const reward of rewards || []) {
    if (reward.status === "applied") {
      logReferralEvent("reward_revoked_skipped_applied", {
        rewardId: reward.id,
        reason,
        qualifyingPaymentId
      });
      continue;
    }
    await supabase
      .from("referral_rewards")
      .update({
        status: "revoked",
        updated_at: new Date().toISOString()
      })
      .eq("id", reward.id);
    revoked += 1;
    logReferralEvent("reward_revoked", { rewardId: reward.id, reason, qualifyingPaymentId });
  }
  return { revoked, referralId: referral.id };
}

export async function findEligibleSubscriptionForHousehold(supabase, householdId, userId) {
  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId);
  const ids = (members || []).map((m) => m.user_id);
  if (!ids.length) ids.push(userId);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role, stripe_subscription_id, subscription_status, plan_id, payment_waived")
    .in("id", ids);

  const eligibleStatuses = new Set(["active", "trialing"]);
  const candidates = (profiles || []).filter(
    (p) =>
      p.stripe_subscription_id &&
      eligibleStatuses.has(String(p.subscription_status || "").toLowerCase()) &&
      !p.payment_waived
  );

  // Prefer the claiming user, then any student with a subscription
  const ordered = [
    ...candidates.filter((p) => p.id === userId),
    ...candidates.filter((p) => p.role === "student" && p.id !== userId),
    ...candidates.filter((p) => p.id !== userId && p.role !== "student")
  ];
  return ordered[0] || null;
}
