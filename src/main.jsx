import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.jsx";
import DashboardRouter from "./dashboard/DashboardRouter.jsx";
import MentorsPage from "./components/MentorsPage.jsx";
import { CheckoutCancelPage, CheckoutSuccessPage } from "./components/BillingResultPage.jsx";
import PlanSelectionPage from "./components/PlanSelectionPage.jsx";
import PreludeMatchOnboardingPage from "./components/onboarding/PreludeMatchOnboardingPage.jsx";
import ParentInviteOnboardingPage from "./components/onboarding/ParentInviteOnboardingPage.jsx";
import RequirePlanGuard from "./components/RequirePlanGuard.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { LegalModalProvider } from "./context/LegalModalContext.jsx";
import LegalModal from "./components/LegalModal.jsx";
import { PreludeMotionProvider } from "./context/MotionContext.jsx";
import ScrollToTop from "./components/ScrollToTop.jsx";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage
} from "./components/AuthPages.jsx";
import { ROUTER_BASENAME } from "./lib/appPaths.js";
import "./index.css";
import "./dashboard/dashboard.css";
import "./dashboard/dashboard-premium.css";
import "./dashboard/dashboard-product.css";
import "./dashboard/prelude-chat.css";
import "./landing-ui.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={ROUTER_BASENAME || undefined}>
      <ScrollToTop />
      <LanguageProvider>
        <PreludeMotionProvider>
        <AuthProvider>
          <LegalModalProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/onboarding/plan" element={<PlanSelectionPage />} />
            <Route path="/onboarding/match" element={<PreludeMatchOnboardingPage />} />
            <Route path="/onboarding/parent" element={<ParentInviteOnboardingPage />} />
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
            {/* Legacy Supabase test routes redirect to main Prelude auth pages. */}
            <Route path="/auth/login" element={<Navigate to="/login" replace />} />
            <Route path="/auth/signup" element={<Navigate to="/register" replace />} />
            <Route path="/auth/forgot-password" element={<Navigate to="/forgot-password" replace />} />
            <Route path="/auth/reset-password" element={<Navigate to="/reset-password" replace />} />
            <Route path="/auth/account" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth/*" element={<Navigate to="/register" replace />} />
          </Routes>
          <LegalModal />
          </LegalModalProvider>
        </AuthProvider>
        </PreludeMotionProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
