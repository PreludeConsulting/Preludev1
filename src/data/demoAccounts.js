/**
 * LOCAL DEVELOPMENT ONLY — demo login credentials.
 * Do not use these passwords in production. Remove or disable before shipping.
 * Run `npm run seed:demo` to create matching users in the development database.
 */

const JORDAN_STUDENT_BASE = {
  password: "Student123!",
  firstName: "Jordan",
  lastName: "Lee",
  role: "STUDENT"
};

/** Jordan Lee — Essay Support (one-time review credits; legacy plan id remains `basic`). */
export const DEMO_STUDENT_BASIC = {
  key: "student-basic",
  email: "jordan-basic@prelude-demo.com",
  plan: "basic",
  displayPlanLabel: "Essay Support",
  ...JORDAN_STUDENT_BASE
};

/** Alias for Essay Support demo account. */
export const DEMO_STUDENT_ESSAY_SUPPORT = DEMO_STUDENT_BASIC;

/** Jordan Lee — Plus plan (rewards + mentor network unlocked). */
export const DEMO_STUDENT_PLUS = {
  key: "student-plus",
  email: "jordan-plus@prelude-demo.com",
  plan: "plus",
  displayPlanLabel: "Plus",
  ...JORDAN_STUDENT_BASE
};

/** Jordan Lee — Pro plan (full access). */
export const DEMO_STUDENT_PRO = {
  key: "student-pro",
  email: "jordan-pro@prelude-demo.com",
  plan: "pro",
  displayPlanLabel: "Pro",
  ...JORDAN_STUDENT_BASE
};

/** Legacy Jordan Plus alias — same dashboard as jordan-plus@. */
export const DEMO_STUDENT = {
  key: "student",
  email: "student@prelude-demo.com",
  plan: "plus",
  displayPlanLabel: "Plus",
  ...JORDAN_STUDENT_BASE
};

/** Legacy Alex account — kept for seed/compat; not on Mentor Asim's demo roster. */
export const DEMO_STUDENT_2 = {
  key: "student2",
  email: "student2@prelude-demo.com",
  password: "Student123!",
  firstName: "Alex",
  lastName: "Kim",
  role: "STUDENT",
  plan: "plus",
  displayPlanLabel: "Plus"
};

export const DEMO_MENTOR = {
  key: "mentor",
  email: "mentor@prelude-demo.com",
  password: "Mentor123!",
  firstName: "Asim",
  lastName: "Yoonas",
  role: "MENTOR",
  avatarUrl: "/media/mentors/asim-yoonas.png"
};

export const DEMO_PARENT = {
  key: "parent",
  email: "parent@prelude-demo.com",
  password: "Parent123!",
  firstName: "Sam",
  lastName: "Lee",
  role: "PARENT"
};

export const JORDAN_PLAN_DEMO_ACCOUNTS = [DEMO_STUDENT_BASIC, DEMO_STUDENT_PLUS, DEMO_STUDENT_PRO];

export const JORDAN_DEMO_ACCOUNTS = [...JORDAN_PLAN_DEMO_ACCOUNTS, DEMO_STUDENT];

export const JORDAN_DEMO_EMAILS = new Set(JORDAN_DEMO_ACCOUNTS.map((account) => account.email.toLowerCase()));

export function isJordanDemoEmail(email) {
  return JORDAN_DEMO_EMAILS.has((email || "").trim().toLowerCase());
}

export const ALL_DEMO_ACCOUNTS = [
  ...JORDAN_DEMO_ACCOUNTS,
  DEMO_STUDENT_2,
  DEMO_MENTOR,
  DEMO_PARENT
];

export function isDemoEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return ALL_DEMO_ACCOUNTS.some((account) => account.email === normalized);
}

export function getDemoAccountByKey(key) {
  return ALL_DEMO_ACCOUNTS.find((account) => account.key === key) || null;
}

export function getDemoAccountByEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return ALL_DEMO_ACCOUNTS.find((account) => account.email === normalized) || null;
}

/** Login-button / mentor-facing plan label (Essay Support instead of Basic). */
export function getDemoLoginPlanLabel(accountOrPlan) {
  if (accountOrPlan && typeof accountOrPlan === "object") {
    if (accountOrPlan.displayPlanLabel) return accountOrPlan.displayPlanLabel;
    return getDemoLoginPlanLabel(accountOrPlan.plan);
  }
  const plan = String(accountOrPlan || "").trim().toLowerCase();
  if (plan === "basic" || plan === "essay_support") return "Essay Support";
  if (plan === "plus") return "Plus";
  if (plan === "pro") return "Pro";
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Prelude";
}
