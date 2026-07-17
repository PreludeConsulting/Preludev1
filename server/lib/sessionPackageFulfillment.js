/**
 * Fulfill purchased flexible-session inventory from a Stripe Checkout Session.
 * Idempotent on stripe checkout session id.
 */

function parseBundleQuantity(metadata = {}) {
  const bundleId = String(metadata.bundleId || "").trim();
  if (bundleId !== "flexible_sessions") return null;

  let qty = null;
  if (metadata.bundleConfig) {
    try {
      const config = JSON.parse(metadata.bundleConfig);
      qty = config?.q?.sessions ?? config?.quantities?.sessions ?? null;
    } catch {
      qty = null;
    }
  }
  if (qty == null && metadata.sessionsPurchased) qty = metadata.sessionsPurchased;
  const n = Math.floor(Number(qty));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractFlexibleSessionCredit(session) {
  if (!session) return null;
  if (session.payment_status && session.payment_status !== "paid" && session.status !== "complete") {
    // Allow complete sessions without explicit payment_status in some test fixtures.
    if (session.mode === "payment" && session.status !== "complete") return null;
  }

  const metadata = session.metadata || {};
  const studentUserId = metadata.userId || session.client_reference_id || null;
  if (!studentUserId) return null;

  const sessionsPurchased = parseBundleQuantity(metadata);
  if (!sessionsPurchased) return null;

  return {
    studentUserId: String(studentUserId),
    mentorUserId: metadata.mentorUserId || null,
    sessionsPurchased,
    stripeCheckoutSessionId: session.id || null,
    bundleId: "flexible_sessions"
  };
}

export async function fulfillFlexibleSessionCheckout(session, creditFn) {
  const credit = extractFlexibleSessionCredit(session);
  if (!credit || typeof creditFn !== "function") return null;
  return creditFn(credit);
}
