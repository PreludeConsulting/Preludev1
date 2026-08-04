import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveJourneyDestination } from "../src/lib/authJourney.js";
import {
  ROLE_SELECTION_PATH,
  MATCH_ONBOARDING_PATH,
  canAccessDashboard,
  postAuthDestination,
  postConfirmationDestination,
  userCanChangeRoleDuringOnboarding,
  userNeedsRoleSelection
} from "../src/lib/onboardingRoutes.js";
import { PUBLIC_ONBOARDING_ROLES, SELECTABLE_ROLES } from "../src/lib/supabaseAuth.js";
import { parentInviteRegisterPath } from "../src/lib/parentLinks.js";

const ROOT = path.resolve(import.meta.dirname, "..");

function readSrc(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function supabaseUser(overrides = {}) {
  return {
    id: "user-1",
    authProvider: "supabase",
    role: "student",
    roleSelectionComplete: false,
    matchOnboardingComplete: false,
    mentorOnboardingComplete: true,
    parentInviteStepComplete: false,
    paymentStepComplete: false,
    ...overrides
  };
}

describe("signup page source contract", () => {
  const registerSource = readSrc("src/components/AuthPages.jsx");
  const registerFn = registerSource.slice(
    registerSource.indexOf("export function RegisterPage"),
    registerSource.indexOf("export function ForgotPasswordPage")
  );

  it("removes promo/referral UI from Create your account", () => {
    expect(registerFn).not.toMatch(/Promo\/Referral Code/i);
    expect(registerFn).not.toMatch(/Apply code/i);
    expect(registerFn).not.toMatch(/PromoOrReferralCodeField/);
    expect(registerFn).not.toMatch(/promoCode/);
    expect(registerFn).not.toMatch(/referral/i);
  });

  it("removes public signup role selector cards", () => {
    expect(registerFn).not.toMatch(/I am signing up as a/);
    expect(registerFn).not.toMatch(/AuthRoleSelector/);
    expect(registerFn).not.toMatch(/role:\s*"STUDENT"/);
    expect(registerFn).not.toMatch(/role:\s*"MENTOR"/);
    expect(registerFn).toMatch(/Create your account, verify your email, and begin your Prelude experience\./);
  });

  it("only sends Parent role when invitation token is present", () => {
    expect(registerFn).toMatch(/invitedAsParent/);
    expect(registerFn).toMatch(/parentInvite/);
    expect(registerFn).toMatch(/role: "PARENT"/);
    expect(registerFn).toMatch(/parentInviteToken/);
  });

  it("routes verified or immediate sessions toward Prelude Match onboarding", () => {
    expect(registerFn).toMatch(/MATCH_ONBOARDING_PATH/);
    expect(registerFn).toMatch(/postConfirmationDestination/);
    expect(registerFn).toMatch(/navigate\("\/verify-email"/);
  });
});

describe("role selection onboarding source contract", () => {
  const rolePage = readSrc("src/components/onboarding/RoleSelectionOnboardingPage.jsx");

  it("offers Student and Mentor only", () => {
    expect(rolePage).toMatch(/role:\s*"student"/);
    expect(rolePage).toMatch(/role:\s*"mentor"/);
    expect(rolePage).not.toMatch(/role:\s*"parent"/);
    expect(rolePage).toMatch(/Parents join through a student invitation/);
  });
});

describe("obsolete signup-only modules", () => {
  it("removes AuthRoleSelector and PromoOrReferralCodeField modules", () => {
    expect(fs.existsSync(path.join(ROOT, "src/components/auth/AuthRoleSelector.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "src/components/auth/PromoOrReferralCodeField.jsx"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "src/components/auth/PromoCodeField.jsx"))).toBe(false);
  });
});

describe("public parent signup blocking", () => {
  it("keeps Parent in app roles but not public onboarding selection", () => {
    expect(SELECTABLE_ROLES).toContain("parent");
    expect(PUBLIC_ONBOARDING_ROLES).toEqual(["student", "mentor"]);
    expect(PUBLIC_ONBOARDING_ROLES).not.toContain("parent");
  });

  it("builds parent invite links without a public role query", () => {
    const pathWithInvite = parentInviteRegisterPath("invite-token-123");
    expect(pathWithInvite).toBe("/register?parentInvite=invite-token-123");
    expect(pathWithInvite).not.toMatch(/role=/);
  });
});

describe("centralized post-auth routing for incomplete signup", () => {
  it("sends incomplete email/password and Google users to the same four-step start", () => {
    const incomplete = supabaseUser({ roleSelectionComplete: false, role: "student" });
    expect(userNeedsRoleSelection(incomplete)).toBe(true);
    expect(postAuthDestination(incomplete)).toBe(ROLE_SELECTION_PATH);
    expect(canAccessDashboard(incomplete)).toBe(false);
    expect(postConfirmationDestination(incomplete, "/dashboard/student/overview")).toBe(ROLE_SELECTION_PATH);
    expect(postConfirmationDestination(incomplete, "/verify-email")).toBe(ROLE_SELECTION_PATH);
  });

  it("does not treat placeholder student as a finalized dashboard user", () => {
    const incomplete = supabaseUser({ role: "student", roleSelectionComplete: false });
    expect(postAuthDestination(incomplete)).not.toMatch(/\/dashboard\//);
  });

  it("returns incomplete users to role selection after login via journey helper", () => {
    const incomplete = supabaseUser({ roleSelectionComplete: false });
    expect(resolveJourneyDestination({ next: "/dashboard" }, incomplete)).toBe(ROLE_SELECTION_PATH);
    expect(resolveJourneyDestination({ next: "/dashboard/student/overview" }, incomplete)).toBe(ROLE_SELECTION_PATH);
  });

  it("lets completed students and mentors reach dashboards", () => {
    const student = supabaseUser({
      role: "student",
      roleSelectionComplete: true,
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: true
    });
    const mentor = supabaseUser({
      role: "mentor",
      roleSelectionComplete: true,
      mentorOnboardingComplete: true
    });
    expect(postAuthDestination(student)).toBe("/dashboard/student/overview");
    expect(postAuthDestination(mentor)).toBe("/dashboard/mentor/overview");
    expect(canAccessDashboard(student)).toBe(true);
    expect(canAccessDashboard(mentor)).toBe(true);
  });

  it("sends completed parents to the parent dashboard", () => {
    const parent = supabaseUser({
      role: "parent",
      roleSelectionComplete: true,
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: true
    });
    expect(postAuthDestination(parent)).toBe("/dashboard/parent/overview");
    expect(canAccessDashboard(parent)).toBe(true);
    expect(userCanChangeRoleDuringOnboarding(parent)).toBe(false);
  });

  it("keeps incomplete students out of match until role is finalized", () => {
    const incomplete = supabaseUser({ roleSelectionComplete: false });
    expect(postAuthDestination(incomplete)).toBe(ROLE_SELECTION_PATH);
    expect(postAuthDestination(incomplete)).not.toBe(MATCH_ONBOARDING_PATH);
  });

  it("prevents dashboard loops by requiring onboarding paths first", () => {
    const incomplete = supabaseUser({ roleSelectionComplete: false });
    const afterConfirm = postConfirmationDestination(incomplete, ROLE_SELECTION_PATH);
    expect(afterConfirm).toBe(ROLE_SELECTION_PATH);
    expect(postConfirmationDestination(incomplete, afterConfirm)).toBe(ROLE_SELECTION_PATH);
  });
});

describe("stripe promo surfaces remain outside signup", () => {
  it("keeps Stripe checkout promotion-code handling intact", () => {
    const stripeFiles = [
      "server/billingConfig.js",
      "server/billingApi.js",
      "shared/promoCodeConstants.js",
      "server/lib/promoCodes.js"
    ];
    for (const file of stripeFiles) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
    }
    const billing = readSrc("server/billingConfig.js");
    expect(billing.length).toBeGreaterThan(0);
  });
});
