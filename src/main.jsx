import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import App from "./App.jsx";
import {
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
  VerifyLoginPage
} from "./components/AuthPages.jsx";

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const DashboardRouter = lazy(() => import("./dashboard/DashboardRouter.jsx"));
const MentorsPage = lazy(() => import("./components/MentorsPage.jsx"));
const ContactPage = lazy(() => import("./components/ContactPage.jsx"));
const CheckoutCancelPage = lazyNamed(() => import("./components/BillingResultPage.jsx"), "CheckoutCancelPage");
const CheckoutSuccessPage = lazyNamed(() => import("./components/BillingResultPage.jsx"), "CheckoutSuccessPage");
const PlanSelectionPage = lazy(() => import("./components/PlanSelectionPage.jsx"));
const PlanDetailPage = lazyNamed(() => import("./components/PlanSelectionPage.jsx"), "PlanDetailPage");
const PlansPage = lazyNamed(() => import("./components/PlanSelectionPage.jsx"), "PlansPage");
const RoleSelectionOnboardingPage = lazy(() => import("./components/onboarding/RoleSelectionOnboardingPage.jsx"));
const PreludeMatchOnboardingPage = lazy(() => import("./components/onboarding/PreludeMatchOnboardingPage.jsx"));
const ParentInviteOnboardingPage = lazy(() => import("./components/onboarding/ParentInviteOnboardingPage.jsx"));
const PaymentOnboardingPage = lazy(() => import("./components/onboarding/PaymentOnboardingPage.jsx"));
const MentorQuestionnaireOnboardingPage = lazy(() => import("./components/onboarding/MentorQuestionnaireOnboardingPage.jsx"));
const PromoRegistrationSuccessPage = lazyNamed(() => import("./components/auth/PromoRegistrationSuccessPage.jsx"), "PromoRegistrationSuccessPage");
const ScrollAnimationTestPage = import.meta.env.DEV
  ? lazy(() => import("./dev/ScrollAnimationTestPage.jsx"))
  : null;
import RequirePlanGuard from "./components/RequirePlanGuard.jsx";
import RequireActiveMembershipGuard from "./components/RequireActiveMembershipGuard.jsx";
import RequireOnboardingAccess from "./components/onboarding/RequireOnboardingAccess.jsx";
import SecuritySettingsRedirect from "./components/SecuritySettingsRedirect.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SubscriptionProvider } from "./context/SubscriptionContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { LegalModalProvider } from "./context/LegalModalContext.jsx";
import LegalModal from "./components/LegalModal.jsx";
import { PreludeMotionProvider } from "./context/MotionContext.jsx";
import { SoundProvider } from "./lib/sound/SoundProvider.jsx";
import { InteractionFeedbackProvider } from "./components/interaction/InteractionFeedback.jsx";
import { MatchAlias, NotFoundPage, OnboardingEntry, PreludeMatchEntry } from "./components/Phase2RouteEntries.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import AuthLandingRedirect from "./components/AuthLandingRedirect.jsx";
import { ROUTER_BASENAME } from "./lib/appPaths.js";
import "./index.css";
import "./styles/auth.css";
import "./dashboard/dashboard.css";
import "./dashboard/dashboard-premium.css";
import "./dashboard/dashboard-product.css";
import "./dashboard/unread-badge.css";
import "./dashboard/progress-rewards.css";
import "./dashboard/constellation.css";
import "./dashboard/prelude-chat.css";
import "./landing-ui.css";
import "./styles/onboarding-flow.css";
import "./styles/plan-wallet.css";
import "./styles/contact.css";
import "./components/interaction/interaction.css";

try {
  sessionStorage.removeItem("prelude-chunk-reload");
} catch {
  /* ignore */
}

function RouteLoadingFallback() {
  return (
    <main className="route-loading" aria-busy="true" aria-live="polite">
      <span className="route-loading__spinner" aria-hidden="true" />
      <p>Loading Prelude…</p>
    </main>
  );
}

function isStaleChunkError(error) {
  const message = String(error?.message || error || "");
  const name = String(error?.name || "");
  return (
    name === "ChunkLoadError" ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message)
  );
}

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("[prelude-route] Page failed to load:", error?.message || error);
    // After a deploy, open tabs often keep an old HTML/JS mix. Reload once.
    if (typeof window === "undefined" || !isStaleChunkError(error)) return;
    const key = "prelude-chunk-reload";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } catch {
      // ignore storage failures; user can still click Reload
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    const detail = String(this.state.error?.message || "").trim();
    return (
      <main className="route-loading" role="alert">
        <h1>This page could not load</h1>
        <p>Prelude may have just been updated. Reload the page to continue.</p>
        {detail ? <p className="dash-muted" style={{ maxWidth: "36rem" }}>{detail}</p> : null}
        <button
          type="button"
          className="dash-btn dash-btn--primary"
          onClick={() => {
            try {
              sessionStorage.removeItem("prelude-chunk-reload");
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        >
          Reload page
        </button>
      </main>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={ROUTER_BASENAME || undefined}>
      <ScrollToTop />
      <AuthLandingRedirect />
      <LanguageProvider>
        <PreludeMotionProvider>
        <SoundProvider>
        <InteractionFeedbackProvider>
        <AuthProvider>
          <SubscriptionProvider>
          <LegalModalProvider>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/promo-success" element={<PromoRegistrationSuccessPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/verify-login" element={<VerifyLoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/settings/security" element={<SecuritySettingsRedirect />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/plans/:planId" element={<PlanDetailPage context="public" />} />
            <Route path="/onboarding/role" element={<RequireOnboardingAccess><RoleSelectionOnboardingPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding/plan" element={<RequireOnboardingAccess><PlanSelectionPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding/plan/:planId" element={<RequireOnboardingAccess><PlanDetailPage context="onboarding" /></RequireOnboardingAccess>} />
            <Route path="/onboarding/match" element={<RequireOnboardingAccess><PreludeMatchOnboardingPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding/parent" element={<RequireOnboardingAccess><ParentInviteOnboardingPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding/payment" element={<RequireOnboardingAccess><PaymentOnboardingPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding/payment/:planId" element={<RequireOnboardingAccess><PlanDetailPage context="payment" /></RequireOnboardingAccess>} />
            <Route path="/onboarding/mentor" element={<RequireOnboardingAccess><MentorQuestionnaireOnboardingPage /></RequireOnboardingAccess>} />
            <Route path="/onboarding" element={<OnboardingEntry />} />
            <Route path="/prelude-match" element={<PreludeMatchEntry />} />
            <Route path="/match" element={<MatchAlias />} />
            <Route path="/dashboard/student/onboarding" element={<OnboardingEntry />} />
            <Route
              path="/dashboard/*"
              element={
                <RequirePlanGuard>
                  <RequireActiveMembershipGuard>
                    <DashboardRouter />
                  </RequireActiveMembershipGuard>
                </RequirePlanGuard>
              }
            />
            <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
            <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
            <Route path="/mentors" element={<MentorsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            {ScrollAnimationTestPage ? (
              <Route
                path="/dev/scroll-test"
                element={
                  <Suspense fallback={null}>
                    <ScrollAnimationTestPage />
                  </Suspense>
                }
              />
            ) : null}
            {/* Legacy Supabase test routes redirect to main Prelude auth pages. */}
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth/signup" element={<Navigate to="/register" replace />} />
            <Route path="/auth/forgot-password" element={<Navigate to="/forgot-password" replace />} />
            <Route path="/auth/reset-password" element={<Navigate to="/reset-password" replace />} />
            <Route path="/auth/account" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth/*" element={<Navigate to="/register" replace />} />
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </RouteErrorBoundary>
          <LegalModal />
          </LegalModalProvider>
          </SubscriptionProvider>
        </AuthProvider>
        </InteractionFeedbackProvider>
        </SoundProvider>
        </PreludeMotionProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
