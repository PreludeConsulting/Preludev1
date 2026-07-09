import { Check, Flame } from "lucide-react";
import { useProgressRewards } from "../../../context/ProgressRewardsContext.jsx";
import { REWARD_TASK_STATUS } from "../../../../lib/rewardTaskCatalog.js";

export default function DailyMomentumCard() {
  const { milestones } = useProgressRewards();
  const loginTask = milestones.find((task) => task.taskTemplateId === "momentum-7-day-login-streak");
  const streakDays = loginTask?.progressCurrent || 0;
  const rewardCoins = loginTask?.coins || 30;
  const weekDays = Array.from({ length: 7 }, (_, i) => ({
    label: ["M", "T", "W", "T", "F", "S", "S"][i],
    status: i < streakDays ? "done" : "pending"
  }));
  const title = "7-Day Momentum Streak";
  const description = "Log in every day to build momentum and unlock claimable coins.";

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
        <span className="dash-rewards-streak__reward">
          +{rewardCoins} Coins {loginTask?.status === REWARD_TASK_STATUS.READY_TO_CLAIM ? "· Ready to claim" : ""}
        </span>
      </div>
    </section>
  );
}
