import AccountPanel from "./components/AccountPanel.jsx";
import Navbar from "./components/Navbar.jsx";
import PreludeChat from "./components/PreludeChat.jsx";
import SignInModal from "./components/SignInModal.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import QuestionnairePage from "./components/QuestionnairePage.jsx";
import UserDashboard from "./components/UserDashboard.jsx";
import {
  AIDashboard,
  CtaFooter,
  FeaturesGrid,
  GamifiedRoadmap,
  HowItWorks,
  MentorMatching,
  Plans,
  ProblemSolution,
  SocialImpact,
  Stats,
  Testimonials
} from "./components/Sections.jsx";

function AppContent() {
  const { requestPersonalizedAi } = useAuth();
  const [hash, setHash] = useState(window.location.hash);

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
        <ProblemSolution />
        <HowItWorks />
        <MentorMatching />
        <FeaturesGrid />
        <Plans />
        <GamifiedRoadmap />
        <AIDashboard />
        <Stats />
        <Testimonials />
        <SocialImpact />
        <CtaFooter />
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
