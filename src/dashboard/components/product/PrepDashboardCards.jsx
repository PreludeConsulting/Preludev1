import { Bot } from "lucide-react";
import PreludeAIWorkspace from "./PreludeAIWorkspace.jsx";
import PreludeRewardsCard from "./PreludeRewardsCard.jsx";

export default function PrepDashboardCards({
  profile,
  studentProfileStats,
  showRewardsPreview = true
}) {
  return (
    <>
      {showRewardsPreview ? <PreludeRewardsCard /> : null}

      <article className="dash-product-card dash-product-card--wide dash-product-card--ai">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">AI Insights</p>
            <h3 className="dash-product-card__title">Prelude AI</h3>
          </div>
          <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>
        <PreludeAIWorkspace profile={profile} studentProfileStats={studentProfileStats} />
      </article>
    </>
  );
}
