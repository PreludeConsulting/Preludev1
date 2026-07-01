import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import AccountPanel from "./AccountPanel.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import Navbar from "./Navbar.jsx";
import PreludeChat from "./PreludeChat.jsx";
import SignInModal from "./SignInModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { EXAMPLE_MENTORS } from "../data/mentors.js";
import { appPath } from "../lib/appPaths.js";
import { dashboardPathForRole, messagesPathForRole } from "../lib/onboardingRoutes.js";

const MENTOR_REVIEWS = [
  {
    quote: "Declan helped me turn my rough essay draft into something that sounded like me instead of a template.",
    name: "Alex Williams",
    role: "Brown student"
  },
  {
    quote: "Ryan gave me a school-list reality check in ten minutes that saved me weeks of guessing.",
    name: "Kye Taylor",
    role: "Penn student"
  },
  {
    quote: "Asim helped me turn a bunch of activities into an actual application story.",
    name: "Kai Thomas",
    role: "Georgia Tech student"
  },
  {
    quote: "Jess made my essay feedback specific, honest, and actually useful in a way I could act on.",
    name: "Keegan Walker",
    role: "Brown student"
  }
];

function MentorsPageContent() {
  const { requestPersonalizedAi, user } = useAuth();
  const findMorePath = user ? (user.role === "parent" ? dashboardPathForRole(user.role) : messagesPathForRole(user.role)) : "/login";
  const featuredMentors = EXAMPLE_MENTORS.slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mentors-page">
          <section className="mentors-page__onepager" aria-labelledby="mentors-page-title">
            <div className="mentors-page__hero-copy">
              <h1 id="mentors-page-title" className="mentors-page__title">
                Meet mentors who made it.
              </h1>
              <p className="mentors-page__intro">
                Prelude matches students with near-peer mentors for essays, school lists, and application momentum.
              </p>
              <div className="mentors-page__actions">
                <Link to="/register" className="mentors-page__primary-action">
                  Get matched
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href={appPath("/#pricing")} className="mentors-page__secondary-action">
                  View plans
                </a>
              </div>
            </div>

            <div className="mentors-page__mentor-art" aria-label="Prelude mentors">
              {featuredMentors.map((mentor, index) => (
                <article
                  className="mentors-page__stamp"
                  key={mentor.name}
                >
                  <img
                    src={mentor.photo}
                    alt={`${mentor.name}, ${mentor.university}`}
                    style={{ objectPosition: mentor.objectPosition }}
                    width={260}
                    height={260}
                    loading="eager"
                    decoding="async"
                  />
                  <span>{mentor.institutionShort}</span>
                </article>
              ))}
            </div>

            <div className="mentors-page__review-carousel" aria-label="Student and parent reviews">
              <div className="mentors-page__review-track">
                {[...MENTOR_REVIEWS, ...MENTOR_REVIEWS].map((review, index) => (
                  <article
                    className="mentors-page__review-card"
                    key={`${review.name}-${index}`}
                    aria-hidden={index >= MENTOR_REVIEWS.length ? "true" : undefined}
                  >
                    <header>
                      <strong>{review.name}</strong>
                      <span>{review.role}</span>
                    </header>
                    <p>“{review.quote}”</p>
                  </article>
                ))}
              </div>
            </div>

            <p className="mentors-page__note">
              Already have an account? Open your dashboard to message mentors and review matches.
            </p>
            <Link to={findMorePath} className="mentors-page__text-link">Open mentor workspace</Link>
          </section>
        </main>
      </div>
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      <LanguageSwitcher />
    </div>
  );
}

export default function MentorsPage() {
  return <MentorsPageContent />;
}
