import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  Building2,
  DollarSign,
  FileText,
  TrendingUp
} from "lucide-react";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import {
  APPLICATION_AI_SUGGESTIONS,
  DEFAULT_ESSAY_TRACKER,
  DEFAULT_FINANCIAL_AID_TRACKER
} from "../../config/studentDashboardByGrade.js";
import { DashBadge, ProgressBar } from "../ui/index.jsx";
import { InsightList, ProgressRing } from "../ui/gamification.jsx";

function MiniBarChart({ values, labels }) {
  const max = Math.max(...values, 1);
  return (
    <div className="dash-mini-chart">
      {values.map((value, i) => (
        <div key={labels[i]} className="dash-mini-chart__col">
          <div className="dash-mini-chart__bar-wrap">
            <span className="dash-mini-chart__bar" style={{ height: `${(value / max) * 100}%` }} />
          </div>
          <span className="dash-mini-chart__label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function statusVariant(status) {
  if (status === "Completed") return "success";
  if (status === "In Progress") return "soft";
  return "muted";
}

export default function ApplicationDashboardCards({
  applicationProgress,
  essayTracker,
  financialAidTracker,
  aiSuggestions,
  reach = 4,
  target = 5,
  safety = 3
}) {
  const progress = applicationProgress || { collegeList: 72, essays: 68, extracurriculars: 55, scholarships: 40, profile: 78 };
  const essays = essayTracker?.length ? essayTracker : DEFAULT_ESSAY_TRACKER;
  const aidItems = financialAidTracker?.length ? financialAidTracker : DEFAULT_FINANCIAL_AID_TRACKER;
  const insights = aiSuggestions?.length ? aiSuggestions : APPLICATION_AI_SUGGESTIONS;
  const appPct = Math.round((progress.collegeList + progress.essays + progress.scholarships + progress.profile) / 4);

  return (
    <>
      <article className="dash-product-card dash-product-card--wide">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">Application Progress</p>
            <h3 className="dash-product-card__title">Overall readiness</h3>
          </div>
          <ProgressRing value={appPct} size={52} label="Application progress" />
        </header>
        <MiniBarChart
          values={[progress.collegeList, progress.essays, progress.extracurriculars, progress.scholarships]}
          labels={["List", "Essays", "Activities", "Aid"]}
        />
        <div className="dash-product-card__metrics">
          <div><span>{progress.collegeList}%</span><small>College list</small></div>
          <div><span>{progress.essays}%</span><small>Essays</small></div>
          <div><span>{progress.scholarships}%</span><small>Financial aid</small></div>
        </div>
      </article>

      <article className="dash-product-card">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">College List</p>
            <h3 className="dash-product-card__title">Your schools</h3>
          </div>
          <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>
        <div className="dash-product-stats-row">
          <div className="dash-product-stat dash-product-stat--reach">
            <span className="dash-product-stat__value">{reach}</span>
            <span className="dash-product-stat__label">Reach</span>
          </div>
          <div className="dash-product-stat dash-product-stat--target">
            <span className="dash-product-stat__value">{target}</span>
            <span className="dash-product-stat__label">Target</span>
          </div>
          <div className="dash-product-stat dash-product-stat--safety">
            <span className="dash-product-stat__value">{safety}</span>
            <span className="dash-product-stat__label">Safety</span>
          </div>
        </div>
        <Link to={`${STUDENT_DASHBOARD_BASE}/workspace`} state={{ workspaceTab: "colleges" }} className="dash-product-card__link">
          View college list <ArrowUpRight className="h-4 w-4" />
        </Link>
      </article>

      <article className="dash-product-card dash-product-card--compact">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">Essay Tracker</p>
            <h3 className="dash-product-card__title">Application essays</h3>
          </div>
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>
        <ul className="dash-product-tracker-list">
          {essays.map((essay) => (
            <li key={essay.id} className="dash-product-tracker-row">
              <span className="dash-product-tracker-row__label">{essay.title}</span>
              <DashBadge variant={statusVariant(essay.status)}>{essay.status}</DashBadge>
            </li>
          ))}
        </ul>
        <Link to={`${STUDENT_DASHBOARD_BASE}/workspace`} state={{ workspaceTab: "essays" }} className="dash-product-card__link">
          Open essay workspace <TrendingUp className="h-4 w-4" />
        </Link>
      </article>

      <article className="dash-product-card">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">Financial Aid</p>
            <h3 className="dash-product-card__title">Aid tracker</h3>
          </div>
          <DollarSign className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>
        <div className="dash-product-aid-list">
          {aidItems.map((item) => (
            <div key={item.id} className="dash-product-aid-item">
              <div className="dash-product-aid-item__head">
                <span>{item.label}</span>
                <DashBadge variant={statusVariant(item.status)}>{item.status}</DashBadge>
              </div>
              {item.label.includes("Scholarship") ? (
                <p className="dash-product-aid-item__count">{item.value} tracked</p>
              ) : (
                <ProgressBar label={item.label} value={item.value} />
              )}
            </div>
          ))}
        </div>
      </article>

      <article className="dash-product-card dash-product-card--feed">
        <header className="dash-product-card__head">
          <div>
            <p className="dash-product-card__eyebrow">AI Insights</p>
            <h3 className="dash-product-card__title">Prelude AI</h3>
          </div>
          <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
        </header>
        <InsightList
          items={insights}
          actionLink={`${STUDENT_DASHBOARD_BASE}/ai`}
          actionLabel="Ask Prelude AI"
        />
      </article>
    </>
  );
}
