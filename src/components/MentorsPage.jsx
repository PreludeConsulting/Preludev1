import { ArrowRight, GraduationCap, Sparkles } from "lucide-react";
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

const mentorCardsImage = `${(import.meta.env?.BASE_URL ?? "/")}media/mentor-team-cards.png`;

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
  const { requestPersonalizedAi } = useAuth();
  const { t } = useLanguage();

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
            <div className="mentors-page__section-heading">
              <p className="mentors-page__eyebrow">{t("mentors.directoryEyebrow")}</p>
              <h2 id="mentors-directory-title">{t("mentors.directoryTitle")}</h2>
            </div>
            <div className="mentors-page__grid">
              {EXAMPLE_MENTORS.map((mentor) => (
                <article className="mentors-page__card" key={mentor.name} tabIndex={0}>
                  <div
                    className={`mentors-page__photo ${mentor.photoClass}`}
                    style={{ backgroundImage: `url(${mentorCardsImage})` }}
                    role="img"
                    aria-label={`${mentor.name}, ${mentor.university}`}
                  />
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
