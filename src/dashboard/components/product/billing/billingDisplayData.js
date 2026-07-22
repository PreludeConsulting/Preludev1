import { PLANS } from "../../../../lib/plans.js";

/** Compatibility export derived from the central plan catalog. */
export const PLAN_BILLING_HIGHLIGHTS = Object.freeze(
  Object.fromEntries(Object.entries(PLANS).map(([id, plan]) => [id, plan.billingHighlights]))
);

export function buildRecentInvoices({ planName, amount, anchorDate = new Date() }) {
  const rows = [];
  for (let i = 0; i < 3; i += 1) {
    const date = new Date(anchorDate);
    date.setMonth(date.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    rows.push({
      id: `INV-${year}-${month}${day}`,
      date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      description: `${planName} Plan – Monthly`,
      amount,
      status: "Paid"
    });
  }
  return rows;
}

export function formatShortBillDate(date) {
  if (!date) return "—";
  const resolved = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(resolved.getTime())) return "—";
  return resolved.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}
