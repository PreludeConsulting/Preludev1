import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, GraduationCap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import AccountPanel from "./AccountPanel.jsx";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { LowerFooter } from "./Sections.jsx";
import Navbar from "./Navbar.jsx";
import PreludeChat from "./PreludeChat.jsx";
import SignInModal from "./SignInModal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { LanguageProvider, useLanguage } from "../context/LanguageContext.jsx";
import { EXAMPLE_MENTORS } from "../data/mentors.js";
import { appPath } from "../lib/appPaths.js";
import { dashboardPathForRole, messagesPathForRole } from "../lib/onboardingRoutes.js";

function MentorEmblem({ mentor }) {
  if (mentor.fallbackEmblem) {
    return <span className="mentors-page__emblem-fallback">{mentor.fallbackEmblem}</span>;
  }

  return (
    <img
      src={mentor.emblem}
      alt=""
      className="mentors-page__emblem"
      width={44}
      height={44}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
    />
  );
}

function MentorsPageContent() {
  const { requestPersonalizedAi, user } = useAuth();
  const { t } = useLanguage();
  const mentorScrollerRef = useRef(null);
  const findMorePath = user ? (user.role === "parent" ? dashboardPathForRole(user.role) : messagesPathForRole(user.role)) : "/login";
  const emptyMentorCards = ["empty-mentor-card-1", "empty-mentor-card-2"];

  const scrollMentors = (direction) => {
    const scroller = mentorScrollerRef.current;

    if (!scroller) return;

    const firstCard = scroller.querySelector(".mentors-page__card");
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 300;
    const styles = window.getComputedStyle(scroller);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;

    scroller.scrollBy({
      left: direction * (cardWidth + gap),
      behavior: "smooth"
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mentors-page">
          <section className="mentors-page__hero" aria-labelledby="mentors-page-title">
            <div className="mentors-page__hero-copy">
              <p className="mentors-page__eyebrow">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {t("mentors.eyebrow")}
              </p>
              <h1 id="mentors-page-title" className="mentors-page__title">
                {t("mentors.headline")}
              </h1>
              <p className="mentors-page__intro">{t("mentors.body")}</p>
              <div className="mentors-page__actions">
                <Link to="/register" className="mentors-page__primary-action">
                  {t("mentors.primaryCta")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <a href={appPath("/#pricing")} className="mentors-page__secondary-action">
                  {t("mentors.secondaryCta")}
                </a>
              </div>
            </div>
            <div className="mentors-page__hero-card" aria-hidden="true">
              <GraduationCap className="h-8 w-8" />
              <span>{t("mentors.heroCardTitle")}</span>
              <strong>{t("mentors.heroCardStat")}</strong>
            </div>
          </section>

          <section className="mentors-page__directory" aria-labelledby="mentors-directory-title">
            <div className="mentors-page__directory-head">
              <div className="mentors-page__section-heading">
                <p className="mentors-page__eyebrow">{t("mentors.directoryEyebrow")}</p>
                <h2 id="mentors-directory-title">{t("mentors.directoryTitle")}</h2>
              </div>
              <div className="mentors-page__scroll-controls" aria-label="Mentor cards carousel controls">
                <button
                  type="button"
                  className="mentors-page__scroll-button"
                  onClick={() => scrollMentors(-1)}
                  aria-label="Scroll mentor cards left"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="mentors-page__scroll-button"
                  onClick={() => scrollMentors(1)}
                  aria-label="Scroll mentor cards right"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="mentors-page__grid" ref={mentorScrollerRef}>
              {EXAMPLE_MENTORS.map((mentor) => (
                <article className="mentors-page__card" key={mentor.name} tabIndex={0}>
                  <div className="mentors-page__photo-shell">
                    <img
                      className="mentors-page__photo"
                      src={mentor.photo}
                      alt={`${mentor.name}, ${mentor.university}`}
                      style={{ objectPosition: mentor.objectPosition }}
                      width={420}
                      height={360}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="mentors-page__card-body">
                    <div className="mentors-page__institution-row">
                      <MentorEmblem mentor={mentor} />
                      <div>
                        <span>{mentor.institutionShort}</span>
                        <p>{mentor.university}</p>
                      </div>
                    </div>
                    <h3>{mentor.name}</h3>
                    <p className="mentors-page__major">{mentor.major}</p>
                    <p className="mentors-page__description">{mentor.description}</p>
                  </div>
                </article>
              ))}
              {emptyMentorCards.map((cardId) => (
                <article className="mentors-page__card mentors-page__card--empty" key={cardId} aria-label="Open mentor card slot" />
              ))}
              <article className="mentors-page__card mentors-page__find-card">
                <div className="mentors-page__find-card-inner">
                  <Sparkles className="h-7 w-7" aria-hidden="true" />
                  <h3>Find more mentors</h3>
                  <p>Browse more Prelude mentors and start the right conversation for your goals.</p>
                  <Link to={findMorePath} className="mentors-page__find-action">
                    Find more mentors
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
          </section>
        </main>
        <LowerFooter />
      </div>
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
      <LanguageSwitcher />
    </div>
  );
}

export default function MentorsPage() {
  return (
    <LanguageProvider>
      <MentorsPageContent />
    </LanguageProvider>
  );
}
