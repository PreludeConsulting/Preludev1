/** Curated benefit bullets for the billing current-plan hero card. */
export const PLAN_BILLING_HIGHLIGHTS = {
  basic: [
    "2 full application component reviews per month",
    "Essays, activities lists, résumés, school lists, and more",
    "Assigned mentor messaging",
    "Personalized student roadmap",
    "Detailed written feedback and edits within 1-2 business days"
  ],
  plus: [
    "Everything in Basic, including 2 full application component reviews per month",
    "2 flexible 1-on-1 session credits per month",
    "College consulting, SAT/ACT prep, or academic tutoring",
    "Full mentor and tutor network messaging",
    "Personalized college and academic guidance",
    "Earn and redeem Prelude Coins"
  ],
  pro: [
    "Everything in Plus, including 2 full application component reviews per month",
    "4 flexible 1-on-1 session credits per month",
    "Mix all session types or focus on one service",
    "Priority mentor-network messaging",
    "Full application review with essay and activity review",
    "Higher coin earning and advanced milestone rewards"
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
