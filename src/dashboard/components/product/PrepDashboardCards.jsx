import { Bot, Code2, FlaskConical, Sun, Trophy } from "lucide-react";
import {
  DEFAULT_ACADEMIC_PROGRESS,
  DEFAULT_OPPORTUNITIES
} from "../../config/studentDashboardByGrade.js";
import { DashBadge } from "../ui/index.jsx";
import { formatOrdinal } from "../ui/gamification.jsx";
import PreludeAIWorkspace from "./PreludeAIWorkspace.jsx";

const PROFILE_STRENGTH_METRICS = [
  { key: "gpaStrength", label: "GPA Strength" },
  { key: "courseRigor", label: "Course Rigor" },
  { key: "activities", label: "Activities" },
  { key: "leadership", label: "Leadership" }
];

const OPPORTUNITY_ICONS = {
  "Summer Program": Sun,
  Research: FlaskConical,
  Competition: Trophy,
  Internship: Code2
};

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

function OpportunityMiniCard({ opportunity }) {
  const Icon = OPPORTUNITY_ICONS[opportunity.category] || Sun;

  return (
    <article className="dash-opp-mini">
      <div className="dash-opp-mini__top">
        <span className="dash-opp-mini__icon" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="dash-opp-mini__match">{opportunity.matchScore ?? 90}% Match</span>
      </div>
      <h4 className="dash-opp-mini__title">{opportunity.title}</h4>
      <div className="dash-opp-mini__meta">
        <DashBadge variant="lavender">{opportunity.category}</DashBadge>
        <span className="dash-opp-mini__due">Due {opportunity.deadline}</span>
      </div>
      <p className="dash-opp-mini__desc">{opportunity.description}</p>
      <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm dash-opp-mini__btn">
        {opportunity.actionLabel}
      </button>
    </article>
  );
}

function OpportunityCenter({ opportunities }) {
  return (
    <article className="dash-product-card dash-product-card--wide dash-product-card--opportunity">
      <header className="dash-product-card__head dash-product-card__head--opportunity">
        <p className="dash-product-card__eyebrow">Opportunity Center</p>
        <h3 className="dash-product-card__title">Recommended for You</h3>
        <p className="dash-opportunity-center__subtext">Hand-picked opportunities to strengthen your profile.</p>
      </header>
      <div className="dash-opportunity-center__grid">
        {opportunities.slice(0, 3).map((opp) => (
          <OpportunityMiniCard key={opp.id} opportunity={opp} />
        ))}
      </div>
    </article>
  );
}

export default function PrepDashboardCards({
  academicProgress,
  opportunities,
  profile,
  studentProfileStats
}) {
  const progress = academicProgress || DEFAULT_ACADEMIC_PROGRESS;
  const opps = opportunities?.length ? opportunities : DEFAULT_OPPORTUNITIES;

  return (
    <>
      <article className="dash-product-card dash-product-card--wide dash-product-card--profile">
        <header className="dash-product-card__head dash-product-card__head--profile-strength">
          <p className="dash-product-card__eyebrow">Academic Progress</p>
          <h3 className="dash-product-card__title">Profile strength</h3>
          <p className="dash-profile-strength__helper">Compared with students in your grade.</p>
        </header>
        <ProfileStrengthBars progress={progress} />
      </article>

      <OpportunityCenter opportunities={opps} />

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
