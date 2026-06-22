import { Check, Flame } from "lucide-react";
import { DAILY_MOMENTUM_STREAK } from "../../../lib/progressRewards.js";

export default function DailyMomentumCard() {
  const { title, description, weekDays, streakDays, rewardCoins } = DAILY_MOMENTUM_STREAK;

  return (
    <section className="dash-rewards-sidebar__card dash-rewards-streak">
      <h3 className="dash-rewards-sidebar__title">{title}</h3>
      <p className="dash-rewards-streak__desc">{description}</p>
      <div className="dash-rewards-streak__week" aria-label="Weekly streak progress">
        {weekDays.map((day, i) => (
          <div key={`${day.label}-${i}`} className="dash-rewards-streak__day">
            <span className={`dash-rewards-streak__dot dash-rewards-streak__dot--${day.status}`}>
              {day.status === "done" ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="dash-rewards-streak__label">{day.label}</span>
          </div>
        ))}
      </div>
      <div className="dash-rewards-streak__footer">
        <span className="dash-rewards-streak__count">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          {streakDays} day streak
        </span>
        <span className="dash-rewards-streak__reward">+{rewardCoins} Coins</span>
      </div>
    </section>
  );
}
