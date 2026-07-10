/** User-facing messages for promo-code validation (spec section 6). */
export const PROMO_ERROR_MESSAGES = {
  not_found: "We could not recognize that promo code. Check the code and try again.",
  inactive: "We could not recognize that promo code. Check the code and try again.",
  not_started: "This promo code is not active yet.",
  expired: "This promo code has expired and can no longer be used.",
  already_redeemed: "This promo code has already been redeemed.",
  redemption_limit_reached: "This promotion has reached its maximum number of redemptions.",
  email_ineligible: "This promo code is not available for this account.",
  wrong_plan: "This promo code is not available for this account.",
  invalid_request: "We could not verify the promo code right now. Please try again.",
  invalid_code_format: "Promo codes can only contain letters, numbers, and hyphens.",
  server_error: "We could not verify the promo code right now. Please try again.",
  rate_limited: "Too many promo code attempts. Please wait and try again."
};

export const PROMO_SUCCESS_TITLE = "Promo code applied successfully";
export const PROMO_SUCCESS_SUBTITLE =
  "Your Basic Plan is complimentary. No payment is required during registration.";

export const PROMO_CODE_PATTERN = /^[A-Z0-9-]+$/;

export function normalizePromoCodeInput(raw = "") {
  return String(raw || "").trim().toUpperCase();
}

export function publicPromoError(errorCode) {
  return PROMO_ERROR_MESSAGES[errorCode] || PROMO_ERROR_MESSAGES.server_error;
}
