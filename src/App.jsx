import AccountPanel from "./components/AccountPanel.jsx";
import Navbar from "./components/Navbar.jsx";
import PreludeChat from "./components/PreludeChat.jsx";
import SignInModal from "./components/SignInModal.jsx";
import LanguageSwitcher from "./components/LanguageSwitcher.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { LanguageProvider } from "./context/LanguageContext.jsx";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Hero from "./components/Hero.jsx";
import NetworkSection from "./components/NetworkSection.jsx";
import StudentNetworkSection from "./components/StudentNetworkSection.jsx";
import UniversityCarousel from "./components/UniversityCarousel.jsx";
import QuestionnairePage from "./components/QuestionnairePage.jsx";
import { SCROLL_STORAGE_KEY } from "./lib/siteSearch.js";
import {
  AdmissionsCostBanner,
  LowerBenefits,
  LowerCta,
  LowerFooter,
  LowerPlans
} from "./components/Sections.jsx";

function AppContent() {
  const { requestPersonalizedAi } = useAuth();
  const navigate = useNavigate();
  const [hash, setHash] = useState(window.location.hash);
  const pathname = window.location.pathname;

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  
  useEffect(() => {
    if (hash === "#preludematch") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (hash === "#dashboard" && !sessionStorage.getItem(SCROLL_STORAGE_KEY)) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    if (hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
      });
    }
  }, [hash]);


  useEffect(() => {
    if (hash === "#dashboard") navigate("/dashboard", { replace: true });
  }, [hash, navigate]);

  if (hash === "#dashboard") {
    return null;
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
        <LanguageSwitcher />
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
        <StudentNetworkSection />
        <NetworkSection />
        <LowerBenefits />
        <LowerPlans />
        <LowerCta />
        <LowerFooter />
      </div>
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      <LanguageSwitcher />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
