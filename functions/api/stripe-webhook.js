import { handleBillingWebhook } from "../_lib/stripeBilling.js";

/**
 * Stripe Dashboard destination alias.
 * Production listens at `/api/stripe-webhook` (also available as `/api/billing/webhook`).
 */
export function onRequest(context) {
  return handleBillingWebhook(context);
}
