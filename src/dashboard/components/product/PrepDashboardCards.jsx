import { Bot } from "lucide-react";
import PreludeAIWorkspace from "./PreludeAIWorkspace.jsx";
import PreludeRewardsCard from "./PreludeRewardsCard.jsx";
import { formatOrdinal } from "../ui/gamification.jsx";

const PROFILE_STRENGTH_METRICS = [
  { key: "gpaStrength", label: "GPA Strength" },
  { key: "courseRigor", label: "Course Rigor" },
  { key: "activities", label: "Activities" },
  { key: "leadership", label: "Leadership" }
];

function ProfileStrengthBars({ progress }) {
  return (
    <div className="dash-profile-strength__bars">
      {PROFILE_STRENGTH_METRICS.map(({ key, label }) => {
        const value = progress[key] ?? 0;
        return (
          <div key={key} className="dash-profile-bar">
            <div className="dash-profile-bar__head">
              <span className="dash-profile-bar__label">{label}</span>
              <span className="dash-profile-bar__value">{formatOrdinal(value)} percentile</span>
            </div>
            <div className="dash-profile-bar__track" aria-hidden="true">
              <span className="dash-profile-bar__fill" style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PrepDashboardCards({
  academicProgress,
  profile,
  studentProfileStats,
  showRewardsPreview = true
}) {
  const hasAcademicProgress = Boolean(academicProgress);

  return (
    <>
      <article className="dash-product-card dash-product-card--wide dash-product-card--profile">
        <header className="dash-product-card__head dash-product-card__head--profile-strength">
          <p className="dash-product-card__eyebrow">Academic Progress</p>
          <h3 className="dash-product-card__title">Profile strength</h3>
          <p className="dash-profile-strength__helper">Compared with students in your grade.</p>
        </header>
        {hasAcademicProgress ? (
          <ProfileStrengthBars progress={academicProgress} />
        ) : (
          <p className="dash-profile-strength__empty dash-muted">
            Add your academics and activities to see how your profile compares with students in your grade.
          </p>
        )}
      </article>

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
