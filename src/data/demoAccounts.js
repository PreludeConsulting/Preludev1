/**
 * LOCAL DEVELOPMENT ONLY — demo login credentials.
 * Do not use these passwords in production. Remove or disable before shipping.
 * Run `npm run seed:demo` to create matching users in the development database.
 */

export const DEMO_STUDENT = {
  key: "student",
  email: "student@prelude-demo.com",
  password: "Student123!",
  firstName: "Jordan",
  lastName: "Lee",
  role: "STUDENT"
};

export const DEMO_STUDENT_2 = {
  key: "student2",
  email: "student2@prelude-demo.com",
  password: "Student123!",
  firstName: "Alex",
  lastName: "Kim",
  role: "STUDENT"
};

export const DEMO_MENTOR = {
  key: "mentor",
  email: "mentor@prelude-demo.com",
  password: "Mentor123!",
  firstName: "Maya",
  lastName: "Patel",
  role: "MENTOR"
};

export const DEMO_PARENT = {
  key: "parent",
  email: "parent@prelude-demo.com",
  password: "Parent123!",
  firstName: "Sam",
  lastName: "Lee",
  role: "PARENT"
};

export const ALL_DEMO_ACCOUNTS = [DEMO_STUDENT, DEMO_STUDENT_2, DEMO_MENTOR, DEMO_PARENT];

export function isDemoEmail(email) {
  const normalized = (email || "").trim().toLowerCase();
  return ALL_DEMO_ACCOUNTS.some((account) => account.email === normalized);
}

export function getDemoAccountByKey(key) {
  return ALL_DEMO_ACCOUNTS.find((account) => account.key === key) || null;
}
