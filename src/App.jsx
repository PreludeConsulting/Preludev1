import Navbar from "./components/Navbar.jsx";
import { useEffect, useState } from "react";
import Hero from "./components/Hero.jsx";
import QuestionnairePage from "./components/QuestionnairePage.jsx";
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

export default function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (hash === "#preludematch") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
        <div className="relative z-10">
          <Navbar />
          <QuestionnairePage />
        </div>
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
    </div>
  );
}
