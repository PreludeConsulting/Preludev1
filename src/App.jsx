import AccountPanel from "./components/AccountPanel.jsx";
import Navbar from "./components/Navbar.jsx";
import PreludeChat from "./components/PreludeChat.jsx";
import SignInModal from "./components/SignInModal.jsx";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Hero from "./components/Hero.jsx";
import NetworkSection from "./components/NetworkSection.jsx";
import StudentNetworkSection from "./components/StudentNetworkSection.jsx";
import UniversityCarousel from "./components/UniversityCarousel.jsx";
import {
  AdmissionsCostBanner,
  LowerBenefits,
  LowerAcademicPrograms,
  LowerCta,
  LowerFooter,
  LowerPlans
} from "./components/Sections.jsx";
import AuraCursor from "./components/motion/AuraCursor.jsx";
import AnimeButtonHoverBinder from "./components/motion/AnimeButtonHoverBinder.jsx";
import { scrollToLandingTarget } from "./lib/landingNavigation.js";

function AppContent() {
  const { requestPersonalizedAi } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hash = location.hash;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = (params.get("type") || "").toLowerCase();
    if (params.get("token_hash") && type === "recovery") {
      navigate(`/reset-password${window.location.search}`, { replace: true });
      return;
    }
    if (!params.has("code") && !params.has("error") && !params.has("error_description")) return;
    navigate(`/auth/callback${window.location.search}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (!hash || hash === "#dashboard" || hash === "#preludematch") return undefined;
    const frame = window.requestAnimationFrame(() => {
      const handled = scrollToLandingTarget(hash.slice(1), {
        behavior: location.state?.landingScroll ? "smooth" : "auto"
      });
      if (!handled) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, location.key, location.state]);


  useEffect(() => {
    if (hash === "#preludematch") {
      navigate("/mentors", { replace: true });
      return;
    }
  }, [hash, navigate]);

  useEffect(() => {
    if (hash === "#dashboard") navigate("/dashboard", { replace: true });
  }, [hash, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main data-landing-content>
          <Hero />
          <UniversityCarousel />
          <AdmissionsCostBanner />
          <StudentNetworkSection />
          <NetworkSection />
          <LowerBenefits />
          <LowerPlans />
          <LowerAcademicPrograms />
          <LowerCta />
          <LowerFooter />
        </main>
      </div>
      <AuraCursor />
      <AnimeButtonHoverBinder />
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      <LanguageSwitcher />
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
