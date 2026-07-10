import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.jsx";

const ScrollAnimationTestPage = import.meta.env.DEV
  ? lazy(() => import("./dev/ScrollAnimationTestPage.jsx"))
  : null;
import DashboardRouter from "./dashboard/DashboardRouter.jsx";
import MentorsPage from "./components/MentorsPage.jsx";
import ContactPage from "./components/ContactPage.jsx";
import { CheckoutCancelPage, CheckoutSuccessPage } from "./components/BillingResultPage.jsx";
import PlanSelectionPage, { PlanDetailPage, PlansPage } from "./components/PlanSelectionPage.jsx";
import RoleSelectionOnboardingPage from "./components/onboarding/RoleSelectionOnboardingPage.jsx";
import PreludeMatchOnboardingPage from "./components/onboarding/PreludeMatchOnboardingPage.jsx";
import ParentInviteOnboardingPage from "./components/onboarding/ParentInviteOnboardingPage.jsx";
import PaymentOnboardingPage from "./components/onboarding/PaymentOnboardingPage.jsx";
import MentorQuestionnaireOnboardingPage from "./components/onboarding/MentorQuestionnaireOnboardingPage.jsx";
import RequirePlanGuard from "./components/RequirePlanGuard.jsx";
import RequireOnboardingAccess from "./components/onboarding/RequireOnboardingAccess.jsx";
import SecuritySettingsRedirect from "./components/SecuritySettingsRedirect.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { LegalModalProvider } from "./context/LegalModalContext.jsx";
import LegalModal from "./components/LegalModal.jsx";
import { PreludeMotionProvider } from "./context/MotionContext.jsx";
import { SoundProvider } from "./lib/sound/SoundProvider.jsx";
import { InteractionFeedbackProvider } from "./components/interaction/InteractionFeedback.jsx";
import { MatchAlias, NotFoundPage, OnboardingEntry, PreludeMatchEntry } from "./components/Phase2RouteEntries.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import AuthLandingRedirect from "./components/AuthLandingRedirect.jsx";
import {
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
  VerifyLoginPage
} from "./components/AuthPages.jsx";
import { PromoRegistrationSuccessPage } from "./components/auth/PromoRegistrationSuccessPage.jsx";
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
          <LegalModalProvider>
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
                  <DashboardRouter />
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
          <LegalModal />
          </LegalModalProvider>
        </AuthProvider>
        </InteractionFeedbackProvider>
        </SoundProvider>
        </PreludeMotionProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
