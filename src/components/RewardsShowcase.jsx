import { Crosshair, Mic, Ticket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import ScrollReveal from "./motion/ScrollReveal.jsx";

const CARD_ICONS = {
  interview: Mic,
  testprep: Crosshair
};

function CoinMark() {
  return (
    <span className="rewards-banner__coin" aria-hidden="true">
      P
    </span>
  );
}

function RewardCard({ card, onAction }) {
  const Icon = CARD_ICONS[card.icon] || Mic;
  const tone = card.tone === "blue" ? "blue" : "green";

  return (
    <article className={`rewards-banner__card rewards-banner__card--${tone}`}>
      <div className="rewards-banner__card-hero" aria-hidden="true">
        <span className="rewards-banner__rarity">{card.rarityBadge}</span>
        <span className="rewards-banner__hero-sheen" />
        <span className="rewards-banner__hero-rays" />
        <span className="rewards-banner__hero-glow" />
        <Ticket className="rewards-banner__float rewards-banner__float--ticket-1" />
        <Ticket className="rewards-banner__float rewards-banner__float--ticket-2" />
        <span className="rewards-banner__float rewards-banner__float--coin-1">P</span>
        <span className="rewards-banner__float rewards-banner__float--coin-2">P</span>
        <span className="rewards-banner__card-icon">
          <Icon />
        </span>
      </div>

      <div className="rewards-banner__card-body">
        <h3 className="rewards-banner__card-title">{card.title}</h3>
        <p className="rewards-banner__card-category">{card.category}</p>

        <div className="rewards-banner__meta">
          <span className="rewards-banner__coins">
            <CoinMark />
            {card.coins}
          </span>
          <span className="rewards-banner__value">{card.value}</span>
        </div>

        <div className="rewards-banner__progress" aria-hidden="true">
          <div className="rewards-banner__progress-track">
            <span className="rewards-banner__progress-fill" />
          </div>
        </div>

        <button type="button" className="rewards-banner__redeem" onClick={onAction}>
          {card.button}
        </button>
      </div>
    </article>
  );
}

export default function RewardsShowcase() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const copy = t("sections.rewardsShowcase") || {};
  const cards = Array.isArray(copy.cards) ? copy.cards : [];
  const ctaHref = user ? `${STUDENT_DASHBOARD_BASE}/progress-rewards` : "/register";

  function goToRewards() {
    navigate(ctaHref);
  }

  return (
    <section
      className="lower-landing__section rewards-banner scroll-mt-28"
      id="academic-support"
      data-section-nav="academic-support"
      aria-labelledby="rewards-banner-heading"
    >
      <div className="pricing-section__stack">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <h2
            id="rewards-banner-heading"
            className="lower-landing__headline lower-landing__headline--center lower-landing__headline--section"
          >
            {copy.headline}
          </h2>
        </ScrollReveal>

        <div className="rewards-banner__shell">
          <div className="rewards-banner__cards">
            {cards.map((card, index) => (
              <ScrollReveal
                key={card.id}
                delay={index * 0.08}
                className="rewards-banner__card-reveal"
              >
                <RewardCard card={card} onAction={goToRewards} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
