import { describe, expect, it } from "vitest";
import {
  isConfirmedAppUser,
  needsEmailConfirmation,
  needsLoginStepUpVerification,
  resolveRestoredLoginVerified,
  shouldFailOpenLoginVerification
} from "../src/lib/authPersistence.js";
import { MATCH_ONBOARDING_PATH, PARENT_ONBOARDING_PATH, PAYMENT_ONBOARDING_PATH } from "../src/lib/onboardingRoutes.js";
import { canAccessOnboardingPath, getOnboardingStepNavigation } from "../src/lib/onboardingFlow.js";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function confirmedStudent(overrides = {}) {
  return {
    id: "user-1",
    email: "ada@example.com",
    emailVerified: true,
    authProvider: "supabase",
    role: "student",
    roleSelectionComplete: true,
    matchOnboardingComplete: false,
    parentInviteStepComplete: false,
    paymentStepComplete: false,
    ...overrides
  };
}

describe("auth persistence policy", () => {
  it("treats a confirmed restored session as logged in even when assurance API is down", () => {
    const user = confirmedStudent();
    expect(
      resolveRestoredLoginVerified({
        user,
        pendingLoginStepUp: false,
        assuranceVerified: false,
        assuranceError: "network"
      })
    ).toBe(true);
  });

  it("keeps pending password login step-up unverified until OTP or trusted device succeeds", () => {
    const user = confirmedStudent();
    expect(
      resolveRestoredLoginVerified({
        user,
        pendingLoginStepUp: true,
        assuranceVerified: false,
        assuranceError: null
      })
    ).toBe(false);
    expect(
      needsLoginStepUpVerification({
        user,
        loginVerified: false,
        pendingLoginStepUp: true
      })
    ).toBe(true);
  });

  it("routes genuinely unverified accounts to email confirmation, not login OTP", () => {
    const user = confirmedStudent({ emailVerified: false });
    expect(needsEmailConfirmation({ user })).toBe(true);
    expect(isConfirmedAppUser(user)).toBe(false);
    expect(
      needsLoginStepUpVerification({
        user,
        loginVerified: false,
        pendingLoginStepUp: true
      })
    ).toBe(false);
  });

  it("treats an explicitly logged-out account as unauthenticated", () => {
    expect(resolveRestoredLoginVerified({ user: null })).toBe(false);
    expect(needsLoginStepUpVerification({ user: null, loginVerified: false })).toBe(false);
    expect(needsEmailConfirmation({ user: null })).toBe(false);
  });

  it("fail-opens when login verification storage/API is temporarily unavailable", () => {
    expect(shouldFailOpenLoginVerification({ status: 503, payload: { error: "login_verification_storage_missing" } })).toBe(true);
    expect(shouldFailOpenLoginVerification({ status: 502, payload: { error: "html_response" } })).toBe(true);
    expect(shouldFailOpenLoginVerification({ status: 401, payload: { error: "incorrect_code" } })).toBe(false);
  });
});

describe("onboarding + stripe return keep the same authenticated account", () => {
  it("lets a confirmed student move through all four onboarding steps without OTP gates", () => {
    const matchUser = confirmedStudent();
    expect(canAccessOnboardingPath(matchUser, MATCH_ONBOARDING_PATH)).toBe(true);

    const afterMatch = confirmedStudent({ matchOnboardingComplete: true });
    expect(canAccessOnboardingPath(afterMatch, PARENT_ONBOARDING_PATH)).toBe(true);
    expect(getOnboardingStepNavigation(afterMatch, PARENT_ONBOARDING_PATH).showNext).toBe(true);

    const afterParent = confirmedStudent({
      matchOnboardingComplete: true,
      parentInviteStepComplete: true
    });
    expect(canAccessOnboardingPath(afterParent, PAYMENT_ONBOARDING_PATH)).toBe(true);
  });

  it("keeps payment/dashboard destinations reachable after a Stripe-style return for the same user", () => {
    const paid = confirmedStudent({
      matchOnboardingComplete: true,
      parentInviteStepComplete: true,
      paymentStepComplete: true
    });
    expect(canAccessOnboardingPath(paid, PAYMENT_ONBOARDING_PATH)).toBe(false);
    expect(paid.emailVerified).toBe(true);
    expect(needsLoginStepUpVerification({ user: paid, loginVerified: true })).toBe(false);
  });
});

describe("supabase client and cookie persistence contracts", () => {
  it("persists and auto-refreshes the browser Supabase session", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/supabase.js"), "utf8");
    expect(src).toMatch(/persistSession:\s*true/);
    expect(src).toMatch(/autoRefreshToken:\s*true/);
    // OAuth is completed on /auth/callback via exchangeCodeForSession; auto
    // URL detection would consume the one-time PKCE code first.
    expect(src).toMatch(/detectSessionInUrl:\s*false/);
  });

  it("completes Google OAuth without a second login OTP for confirmed users", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/components/AuthPages.jsx"), "utf8");
    const callback = src.slice(src.indexOf("export function AuthCallbackPage"), src.indexOf("export function VerifyLoginPage"));
    expect(callback).toMatch(/forceVerified:\s*true/);
    expect(callback).not.toMatch(/beginLoginVerification/);
    expect(callback).not.toMatch(/verify-login/);
  });

  it("uses Lax SameSite cookies so Stripe returns keep trusted-device / assurance cookies", () => {
    const nodeApi = fs.readFileSync(path.join(ROOT, "server/supabaseLoginVerificationApi.js"), "utf8");
    const cfApi = fs.readFileSync(path.join(ROOT, "functions/_lib/loginVerification.js"), "utf8");
    expect(nodeApi).toMatch(/sameSite:\s*"lax"/);
    expect(cfApi).toMatch(/SameSite=Lax/);
    expect(cfApi).toMatch(/TRUSTED_DEVICE_DAYS\s*=\s*30/);
  });

  it("does not clear localStorage/sessionStorage during onboarding or dashboard restore", () => {
    const authContext = fs.readFileSync(path.join(ROOT, "src/context/AuthContext.jsx"), "utf8");
    const onboardingGuard = fs.readFileSync(path.join(ROOT, "src/components/onboarding/RequireOnboardingAccess.jsx"), "utf8");
    expect(authContext).not.toMatch(/localStorage\.clear\(/);
    expect(authContext).not.toMatch(/sessionStorage\.clear\(/);
    expect(onboardingGuard).not.toMatch(/signOut\(/);
    expect(onboardingGuard).not.toMatch(/verify-login/);
  });

  it("keeps route guards from OTP-bouncing while auth is still loading", () => {
    for (const relative of [
      "src/components/RequireLoginVerification.jsx",
      "src/components/RequirePlanGuard.jsx",
      "src/dashboard/components/RoleGuard.jsx",
      "src/components/onboarding/RequireOnboardingAccess.jsx"
    ]) {
      const src = fs.readFileSync(path.join(ROOT, relative), "utf8");
      expect(src).toMatch(/if\s*\(\s*!ready\s*\)/);
      expect(src).toMatch(/AuthLoadingState/);
    }
  });
});

describe("trusted device behavior", () => {
  it("requires trust-device opt-in when creating the 30-day trusted device cookie", () => {
    const verifyPage = fs.readFileSync(path.join(ROOT, "src/components/AuthPages.jsx"), "utf8");
    expect(verifyPage).toMatch(/Trust this device for 30 days/);
    expect(verifyPage).toMatch(/trustDevice/);
    expect(verifyPage).toMatch(/verifyLoginCode\(\{\s*challengeId,\s*code,\s*trustDevice/);

    const nodeApi = fs.readFileSync(path.join(ROOT, "server/supabaseLoginVerificationApi.js"), "utf8");
    expect(nodeApi).toMatch(/if \(payload\.trustDevice\)/);
    expect(nodeApi).toMatch(/TRUSTED_DEVICE_COOKIE/);
    expect(nodeApi).toMatch(/TRUSTED_DEVICE_DAYS/);
  });
});

describe("expired access token with valid refresh token", () => {
  it("keeps autoRefreshToken enabled so supabase-js can renew access tokens quietly", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/supabase.js"), "utf8");
    expect(src).toMatch(/autoRefreshToken:\s*true/);
    expect(src).toMatch(/persistSession:\s*true/);
  });

  it("does not clear the authenticated user when silent refresh hydration fails", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/context/AuthContext.jsx"), "utf8");
    expect(src).toMatch(/Do not clear an existing user on a transient profile\/API failure/);
    expect(src).toMatch(/pendingLoginStepUpRef/);
  });
});
