import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useLanguage } from "../context/LanguageContext.jsx";
import PreludeMatch from "./hero/PreludeMatch.jsx";
import {
  HeroFormAnimation,
  HeroHeadline,
  HeroMotionController,
  HeroNote,
  HeroSubcopy,
  HeroVisualAnimation,
  useHeroMotionRefs
} from "./hero/HeroIntroAnimation.jsx";

const contactPath = `${import.meta.env.BASE_URL}contact`.replace(/\/+/g, "/");

export default function Hero() {
  const [email, setEmail] = useState("");
  const { t } = useLanguage();
  const heroRefs = useHeroMotionRefs();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    const target = trimmed
      ? `${contactPath}?email=${encodeURIComponent(trimmed)}#book-call`
      : `${contactPath}#book-call`;
    window.location.href = target;
  }

  return (
    <section
      id="home"
      data-section-nav="home"
      className="shopify-hero"
      data-aura-zone
      ref={(node) => {
        heroRefs.current.section = node;
      }}
    >
      <div className="shopify-hero__bg" aria-hidden="true" />
      <HeroMotionController heroRefs={heroRefs}>
        <div className="shopify-hero__inner">
          <div className="shopify-hero__grid">
            <div className="shopify-hero__copy">
              <div className="shopify-hero__stack">
                <HeroHeadline heroRefs={heroRefs} />
                <HeroSubcopy heroRefs={heroRefs}>
                  {t("hero.subcopy")}
                </HeroSubcopy>
                <HeroFormAnimation heroRefs={heroRefs}>
                  <form className="shopify-hero__form" onSubmit={handleSubmit}>
                    <label className="sr-only" htmlFor="hero-email">
                      {t("hero.emailLabel")}
                    </label>
                    <input
                      id="hero-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder={t("hero.emailPlaceholder")}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="shopify-hero__input"
                    />
                    <button type="submit" className="shopify-hero__cta">
                      {t("hero.cta")}
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                </HeroFormAnimation>
                <HeroNote heroRefs={heroRefs}>
                  {t("hero.note")}
                </HeroNote>
              </div>
            </div>

            <HeroVisualAnimation heroRefs={heroRefs}>
              <div className="shopify-hero__deco shopify-hero__deco--one" aria-hidden="true" />
              <div className="shopify-hero__deco shopify-hero__deco--two" aria-hidden="true" />
              <PreludeMatch />
            </HeroVisualAnimation>
          </div>
        </div>
      </HeroMotionController>
    </section>
  );
}
