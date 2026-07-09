import { Check, ChevronRight } from "lucide-react";
import { useProgressRewards } from "../../../context/ProgressRewardsContext.jsx";
import { REWARD_TASK_STATUS } from "../../../../lib/rewardTaskCatalog.js";

function CircleProgress({ total, completed }) {
  return (
    <div className="dash-rewards-challenge__circles" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step <= completed;
        return (
          <span
            key={step}
            className={`dash-rewards-challenge__circle${done ? " dash-rewards-challenge__circle--done" : ""}`}
          >
            {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : step}
          </span>
        );
      })}
    </div>
  );
}

function CheckRow({ total }) {
  return (
    <div className="dash-rewards-challenge__checks" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="dash-rewards-challenge__check">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      ))}
    </div>
  );
}

function ChallengeRow({ challenge }) {
  return (
    <article className={`dash-rewards-challenge__item dash-rewards-challenge__item--${challenge.status}`}>
      <div className="dash-rewards-challenge__main">
        <p className="dash-rewards-challenge__title">{challenge.title}</p>
        {challenge.type === "circles" ? (
          <CircleProgress total={challenge.total} completed={challenge.completed} />
        ) : null}
        {challenge.type === "checks" ? <CheckRow total={challenge.total} /> : null}
        <p className="dash-rewards-challenge__hint">{challenge.hint}</p>
      </div>
      <div className="dash-rewards-challenge__aside">
        <span className="dash-rewards-challenge__coins">+{challenge.coins} Coins</span>
        {challenge.type === "chevron" ? (
          <ChevronRight className="dash-rewards-challenge__chevron h-4 w-4" aria-hidden="true" />
        ) : null}
      </div>
    </article>
  );
}

export default function ChallengesCard({ onViewAll = null }) {
  const { milestones } = useProgressRewards();
  const challengeCards = milestones
    .filter((task) => task.category === "momentum" || task.category === "admissions")
    .slice(0, 4)
    .map((task) => ({
      id: task.id,
      title: task.title,
      coins: task.coins,
      total: task.progressTarget || 1,
      completed: task.status === REWARD_TASK_STATUS.CLAIMED ? task.progressTarget || 1 : task.progressCurrent || 0,
      hint:
        task.status === REWARD_TASK_STATUS.CLAIMED
          ? "Claimed"
          : task.claimable
            ? "Ready to claim"
            : `${task.progressCurrent || 0} / ${task.progressTarget || 1}`,
      status: task.status === REWARD_TASK_STATUS.CLAIMED ? "completed" : "active",
      type: (task.progressTarget || 1) > 1 ? "circles" : "chevron"
    }));

  return (
    <section className="dash-rewards-sidebar__card dash-rewards-challenges">
      <div className="dash-rewards-challenges__head">
        <h3 className="dash-rewards-sidebar__title">Challenges / Tasks</h3>
        <button
          type="button"
          className="dash-rewards-challenges__view-all"
          onClick={() => {
            if (typeof onViewAll === "function") onViewAll();
            const earnSection = document.getElementById("earn");
            earnSection?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          View all
        </button>
      </div>
      <div className="dash-rewards-challenges__list">
        {challengeCards.map((challenge) => (
          <ChallengeRow key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </section>
  );
}
