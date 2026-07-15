/** Shared referral-code constants (client + server). */

export const REFERRAL_DISCOUNT_PERCENT = 20;
export const REFERRAL_CLAIM_LEAD_DAYS = 7;
export const REFERRAL_CODE_PATTERN = /^[A-Z][A-Z0-9]{1,15}-[A-Z0-9]{4}$/;

export const REFERRAL_ELIGIBLE_ROLES = Object.freeze(["student", "parent"]);

export const REFERRAL_ERROR_MESSAGES = Object.freeze({
  not_found: "We could not recognize that referral code. Check the code and try again.",
  inactive: "This referral code is no longer available.",
  expired: "This referral code has expired and can no longer be used.",
  disabled: "This referral code is no longer available.",
  self_referral: "You cannot use your household’s own referral code.",
  same_household: "You cannot use a referral code from your own household.",
  mentor_ineligible: "Referral codes are only available for Student and Parent accounts.",
  role_ineligible: "Referral codes cannot be used with the selected account type.",
  already_referred: "This account has already used a referral discount.",
  household_already_referred: "This household has already received a new-customer referral discount.",
  benefit_already_applied: "You can only use one promo or referral code per account.",
  invalid_code_format: "Referral codes use letters, numbers, and a hyphen (for example PETER-K7Q4).",
  invalid_request: "We could not verify the referral code right now. Please try again.",
  server_error: "We could not verify the referral code right now. Please try again.",
  rate_limited: "Too many referral code attempts. Please wait and try again.",
  reward_unavailable: "This referral reward is no longer available.",
  reward_already_claimed: "This referral reward has already been claimed.",
  subscription_ineligible: "An active monthly subscription is required to claim this reward.",
  claim_cutoff:
    "This reward must be claimed at least 7 days before the end of your current billing period to apply to the next payment. It remains available — try again after your next renewal, or wait until there are at least 7 days left in the period.",
  claim_race: "Another household member just claimed this reward.",
  not_authenticated: "Please sign in to continue."
});

export const REFERRAL_SUCCESS_MESSAGE =
  "Referral code applied. You’ll receive 20% off your first monthly subscription payment.";

export const REFERRAL_REWARD_NOTIFICATION = Object.freeze({
  title: "Your referral reward is ready",
  body:
    "Someone joined using your referral code. Claim 20% off your next monthly subscription payment. You must claim this reward at least 7 days before the end of your current billing period for it to apply to the next payment."
});

export function normalizeReferralCodeInput(raw = "") {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function publicReferralError(errorCode) {
  return REFERRAL_ERROR_MESSAGES[errorCode] || REFERRAL_ERROR_MESSAGES.server_error;
}

export function isReferralEligibleRole(role) {
  return REFERRAL_ELIGIBLE_ROLES.includes(String(role || "").toLowerCase());
}

export function logReferralEvent(event, payload = {}) {
  const safe = { ...payload };
  delete safe.email;
  delete safe.stripeCustomerId;
  delete safe.paymentMethod;
  delete safe.card;
  console.info(
    JSON.stringify({
      source: "prelude-referral",
      event,
      timestamp: new Date().toISOString(),
      ...safe
    })
  );
}
