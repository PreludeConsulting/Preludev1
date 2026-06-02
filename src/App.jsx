import AccountPanel from "./components/AccountPanel.jsx";
import Navbar from "./components/Navbar.jsx";
import PreludeChat from "./components/PreludeChat.jsx";
import SignInModal from "./components/SignInModal.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import UniversityCarousel from "./components/UniversityCarousel.jsx";
import QuestionnairePage from "./components/QuestionnairePage.jsx";
import UserDashboard from "./components/UserDashboard.jsx";
import { DashboardPage, ForgotPasswordPage, LoginPage, ProfilePage, RegisterPage, ResetPasswordPage, SettingsPage, VerifyEmailPage } from "./components/AuthPages.jsx";
import {
  AdmissionsCostBanner,
  LowerBenefits,
  LowerCta,
  LowerFeatureIntro,
  LowerFooter,
  LowerPlans,
  LowerSplitVisual
} from "./components/Sections.jsx";

function AppContent() {
  const { requestPersonalizedAi } = useAuth();
  const [hash, setHash] = useState(window.location.hash);
  const pathname = window.location.pathname.startsWith("/Preludev1")
    ? window.location.pathname.replace(/^\/Preludev1/, "") || "/"
    : window.location.pathname;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  
  useEffect(() => {
    if (hash === "#preludematch" || hash === "#dashboard") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [hash]);


  const route = pathname;
  const authPage = {
    "/register": <RegisterPage />,
    "/login": <LoginPage />,
    "/forgot-password": <ForgotPasswordPage />,
    "/reset-password": <ResetPasswordPage />,
    "/verify-email": <VerifyEmailPage />,
    "/dashboard": <DashboardPage />,
    "/profile": <ProfilePage />,
    "/settings": <SettingsPage />
  }[route];

  if (authPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
        <div className="relative z-10">{authPage}</div>
      </div>
    );
  }

  if (hash === "#dashboard") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
        <div className="relative z-10">
          <Navbar />
          <UserDashboard />
        </div>
        <PreludeChat />
        <SignInModal />
        <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      </div>
    );
  }

  if (hash === "#preludematch") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
        <div className="relative z-10">
          <Navbar />
          <QuestionnairePage />
        </div>
        <PreludeChat />
        <SignInModal />
        <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <UniversityCarousel />
        <AdmissionsCostBanner />
        <LowerFeatureIntro />
        <LowerSplitVisual />
        <LowerBenefits />
        <LowerPlans />
        <LowerCta />
        <LowerFooter />
      </div>
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
