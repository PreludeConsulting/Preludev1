import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import AccountPanel from "./AccountPanel.jsx";
import Navbar from "./Navbar.jsx";
import PreludeChat from "./PreludeChat.jsx";
import SignInModal from "./SignInModal.jsx";
import MentorDetailModal from "./mentors/MentorDetailModal.jsx";
import MentorStampDeck from "./mentors/MentorStampDeck.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { EXAMPLE_MENTORS } from "../data/mentors.js";
import { useReducedMotion } from "../lib/useReducedMotion.js";
import "../styles/mentors-page.css";

const MENTOR_REVIEWS = [
  {
    quote:
      "Working with Moon completely changed the way I saw my application. He helped me connect my identity and passions into one story that finally felt true to who I am. His guidance gave me so much confidence, and it inspired me to become a mentor too!",
    name: "Destiny Park",
    label: "Emory University",
    highlight: "Moon"
  },
  {
    quote:
      "Asim was genuinely incredible. He taught me testing strategies that completely changed how I approached the SAT, especially with question patterns and time management. With his help, I was able to push my score past a 1540!",
    name: "Emily Carter",
    label: "Northwestern University",
    highlight: "Asim"
  },
  {
    quote:
      "Peter completely opened my eyes to computer science. He explained the different paths within the field and what studying CS really looks like today. Because of him, I found a real passion for computer science and now feel so excited about my future in it!",
    name: "Jackson Fleece",
    label: "Carnegie Mellon University",
    highlight: "Peter"
  }
];

function renderQuote(quote, highlight) {
  if (!highlight) return quote;
  const parts = quote.split(highlight);
  return parts.map((part, index) => (
    <span key={index}>
      {part}
      {index < parts.length - 1 ? <strong>{highlight}</strong> : null}
    </span>
  ));
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay, duration: 0.48, ease: "easeOut" }
  })
};

function MentorsPageContent() {
  const { requestPersonalizedAi } = useAuth();
  const reducedMotion = useReducedMotion();
  const [selectedMentor, setSelectedMentor] = useState(null);
  const featuredMentors = EXAMPLE_MENTORS.slice(0, 5);
  const reviewSlides = reducedMotion ? MENTOR_REVIEWS : [...MENTOR_REVIEWS, ...MENTOR_REVIEWS];

  const MotionTag = reducedMotion ? "p" : motion.p;
  const MotionH1 = reducedMotion ? "h1" : motion.h1;
  const MotionP = reducedMotion ? "p" : motion.p;
  const MotionDiv = reducedMotion ? "div" : motion.div;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0 paper-grain" aria-hidden="true" />
      <div className="relative z-10">
        <Navbar />
        <main className="mentors-page">
          <div className="mentors-page__bg" aria-hidden="true" />
          <div className="mentors-page__inner">
            <section className="mentors-page__showcase" aria-labelledby="mentors-page-title">
              <MotionTag
                className="mentors-page__eyebrow"
                {...(reducedMotion ? {} : { initial: "hidden", animate: "show", custom: 0, variants: fadeUp })}
              >
                PRELUDEMATCH
              </MotionTag>

              <MotionDiv
                className="mentors-page__deck-wrap"
                {...(reducedMotion ? {} : { initial: "hidden", animate: "show", custom: 0.06, variants: fadeUp })}
              >
                <MentorStampDeck mentors={featuredMentors} onSelectMentor={setSelectedMentor} />
              </MotionDiv>

              <MotionH1
                id="mentors-page-title"
                className="mentors-page__title"
                {...(reducedMotion ? {} : { initial: "hidden", animate: "show", custom: 0.14, variants: fadeUp })}
              >
                <span className="mentors-page__title-line">Not one advisor.</span>
                <span className="mentors-page__title-line">
                  A <span className="mentors-page__title-accent">whole network.</span>
                </span>
              </MotionH1>

              <MotionP
                className="mentors-page__subtitle"
                {...(reducedMotion ? {} : { initial: "hidden", animate: "show", custom: 0.2, variants: fadeUp })}
              >
                Access a full network of mentors from top universities who guide your unique path through high school, college applications, and beyond.
              </MotionP>

              <MotionDiv
                {...(reducedMotion ? {} : { initial: "hidden", animate: "show", custom: 0.26, variants: fadeUp })}
              >
                <Link to="/register" className="shopify-hero__cta mentors-page__cta">
                  Get matched
                </Link>
              </MotionDiv>
            </section>

            <section className="mentors-page__reviews" aria-label="Student reviews">
              <div className="mentors-page__reviews-viewport">
                <div
                  className={`mentors-page__reviews-track${reducedMotion ? " mentors-page__reviews-track--static" : ""}`}
                >
                  {reviewSlides.map((review, index) => (
                    <article
                      className="mentors-page__review-card"
                      key={`${review.name}-${index}`}
                      aria-hidden={index >= MENTOR_REVIEWS.length ? "true" : undefined}
                    >
                      <span className="mentors-page__review-accent" aria-hidden="true" />
                      <header className="mentors-page__review-header">
                        <p className="mentors-page__review-name">{review.name}</p>
                        <p className="mentors-page__review-label">{review.label}</p>
                      </header>
                      <p className="mentors-page__review-quote">&ldquo;{renderQuote(review.quote, review.highlight)}&rdquo;</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      <MentorDetailModal mentor={selectedMentor} onClose={() => setSelectedMentor(null)} />
      <PreludeChat />
      <SignInModal />
      <AccountPanel onOpenPersonalizedAi={requestPersonalizedAi} />
    </div>
  );
}

export default function MentorsPage() {
  return <MentorsPageContent />;
}
