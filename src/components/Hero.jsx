import { useState } from "react";
import { useLanguage } from "../context/LanguageContext.jsx";
import PreludeMatch from "./hero/PreludeMatch.jsx";
import { HeroFormAnimation, HeroHeadline, HeroNote, HeroSubcopy, HeroVisualAnimation } from "./hero/HeroIntroAnimation.jsx";

const registerPath = `${import.meta.env.BASE_URL}register`.replace(/\/+/g, "/");

export default function Hero() {
  const [email, setEmail] = useState("");
  const { t } = useLanguage();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    const target = trimmed
      ? `${registerPath}?email=${encodeURIComponent(trimmed)}`
      : registerPath;
    window.location.href = target;
  }

  return (
    <section id="home" className="shopify-hero">
      <div className="shopify-hero__bg" aria-hidden="true" />
      <div className="shopify-hero__inner">
        <div className="shopify-hero__grid">
          <div className="shopify-hero__copy">
            <div className="shopify-hero__stack">
              <HeroHeadline />
              <HeroSubcopy>
                {t("hero.subcopy")}
              </HeroSubcopy>
              <HeroFormAnimation>
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
                  </button>
                </form>
              </HeroFormAnimation>
              <HeroNote>
                {t("hero.note")}
              </HeroNote>
            </div>
          </div>

          <HeroVisualAnimation>
            <div className="shopify-hero__deco shopify-hero__deco--one" aria-hidden="true" />
            <div className="shopify-hero__deco shopify-hero__deco--two" aria-hidden="true" />
            <PreludeMatch />
          </HeroVisualAnimation>
        </div>
      </div>
    </section>
  );
}
