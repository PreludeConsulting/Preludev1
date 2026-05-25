import Navbar from "./components/Navbar.jsx";
import Hero from "./components/Hero.jsx";
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
