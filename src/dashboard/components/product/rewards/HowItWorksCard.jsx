import { Gift, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { HOW_IT_WORKS_STEPS } from "../../../lib/progressRewards.js";
import { STUDENT_DASHBOARD_BASE } from "../../../../lib/dashboardRoutes.js";
import { CoinIcon } from "./PreludePiggyBank.jsx";

const STEP_ICONS = {
  target: Target,
  coins: CoinIcon,
  gift: Gift
};

export default function HowItWorksCard() {
  return (
    <section className="dash-rewards-sidebar__card dash-rewards-how">
      <h3 className="dash-rewards-sidebar__title">How It Works</h3>
      <ol className="dash-rewards-how__list">
        {HOW_IT_WORKS_STEPS.map((step, index) => {
          const Icon = STEP_ICONS[step.icon] || Sparkles;
          return (
            <li key={step.id} className="dash-rewards-how__item">
              <span className="dash-rewards-how__step">{index + 1}</span>
              <span className="dash-rewards-how__icon" aria-hidden="true">
                {step.icon === "coins" ? <Icon size="sm" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="dash-rewards-how__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <Link to={`${STUDENT_DASHBOARD_BASE}/progress-rewards#earn`} className="dash-rewards-how__link">
        Learn more about rewards →
      </Link>
    </section>
  );
}
