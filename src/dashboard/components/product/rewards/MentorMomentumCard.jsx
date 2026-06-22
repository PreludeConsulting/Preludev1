import { Check, Flame } from "lucide-react";
import { MENTOR_MOMENTUM_MODULES } from "../../../lib/progressRewards.js";

function GlowBar({ pct, className = "" }) {
  return (
    <div className={`dash-mm-bar${className ? ` ${className}` : ""}`} aria-hidden="true">
      <span className="dash-mm-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function WeekTracker({ weekDays }) {
  return (
    <div className="dash-mm-week" aria-label="Weekly messaging streak">
      {weekDays.map((day, i) => (
        <div key={`${day.label}-${i}`} className="dash-mm-week__col">
          <span className={`dash-mm-week__dot dash-mm-week__dot--${day.status}`}>
            {day.status === "done" ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
          </span>
          <span className="dash-mm-week__label">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

function HeroStreak({ module }) {
  const pct = Math.min(100, Math.round((module.current / module.goal) * 100));

  return (
    <div className="dash-mm-hero">
      <div className="dash-mm-hero__top">
        <span className="dash-mm-hero__flame" aria-hidden="true">
          <Flame className="h-4 w-4" />
        </span>
        <span className="dash-mm-hero__label">{module.title}</span>
      </div>
      <p className="dash-mm-hero__value">{module.statLabel}</p>
      <p className="dash-mm-hero__goal">
        {module.current} / {module.goal} Days
      </p>
      <GlowBar pct={pct} className="dash-mm-bar--hero" />
      <WeekTracker weekDays={module.weekDays} />
      <p className="dash-mm-hero__reward">+{module.reward} Coins</p>
    </div>
  );
}

function MetricRow({ module }) {
  const pct = Math.min(100, Math.round((module.current / module.goal) * 100));

  return (
    <div className="dash-mm-metric">
      <div className="dash-mm-metric__head">
        <span className="dash-mm-metric__emoji" aria-hidden="true">{module.emoji}</span>
        <span className="dash-mm-metric__title">{module.title}</span>
        <span className="dash-mm-metric__reward">+{module.reward} Coins</span>
      </div>
      <p className="dash-mm-metric__stat">
        {module.current} / {module.goal} Completed
      </p>
      <GlowBar pct={pct} className="dash-mm-bar--metric" />
      {module.hint ? <p className="dash-mm-metric__hint">{module.hint}</p> : null}
    </div>
  );
}

export default function MentorMomentumCard() {
  const { messaging, meetings, checkIns, nextReward } = MENTOR_MOMENTUM_MODULES;

  return (
    <section className="dash-rewards-sidebar__card dash-mm-card" aria-label="Mentor Momentum">
      <header className="dash-mm-card__header">
        <span className="dash-mm-card__title">
          <span aria-hidden="true">🔥</span> Mentor Momentum
        </span>
      </header>

      <HeroStreak module={messaging} />

      <div className="dash-mm-card__metrics">
        <MetricRow module={meetings} />
        <MetricRow module={checkIns} />
      </div>

      {nextReward ? (
        <footer className="dash-mm-next">
          <p className="dash-mm-next__label">
            <span aria-hidden="true">🎁</span> Next Reward
          </p>
          <p className="dash-mm-next__title">{nextReward.headline}</p>
          <p className="dash-mm-next__away">
            {nextReward.coinsAway > 0 ? `${nextReward.coinsAway} Coins Away` : "Ready to redeem"}
          </p>
          <GlowBar pct={nextReward.progressPct} className="dash-mm-bar--next" />
        </footer>
      ) : null}
    </section>
  );
}
