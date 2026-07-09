/** Curated benefit bullets for the billing current-plan hero card. */
export const PLAN_BILLING_HIGHLIGHTS = {
  basic: [
    "Personalized college roadmap",
    "Matched mentor through PreludeMatch",
    "Progress tracking dashboard",
    "Financial aid & scholarship resources",
    "Prelude AI assistant access"
  ],
  plus: [
    "Two 1-on-1 mentor sessions per month",
    "Expanded direct messaging",
    "Customized application roadmap",
    "Essay feedback and revision support",
    "Identity-building coaching"
  ],
  pro: [
    "Unlimited college list and tracking",
    "Personalized mentor guidance",
    "Priority message support",
    "Advanced progress analytics",
    "Exclusive rewards and perks"
  ]
};

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
