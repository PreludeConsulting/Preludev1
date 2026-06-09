import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  Building2,
  Calendar,
  ChevronRight,
  FileText,
  Sparkles,
  TrendingUp,
  Video
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";
import { Avatar, DashBadge, ProgressBar } from "../ui/index.jsx";
import { ActivityFeed, InsightList, ProgressRing } from "../ui/gamification.jsx";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

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

export default function StudentOverviewProduct() {
  const { user } = useAuth();
  const { meetings, mentor, summaryCards, aiSuggestions, deadlines, applicationProgress } = useDashboardData();
  const gamification = useGamification();
  const firstName = user?.name?.split(" ")[0] || "Jordan";
  const progress = applicationProgress || { collegeList: 72, essays: 68, extracurriculars: 55, scholarships: 40, profile: 78 };
  const cards = summaryCards || {};
  const priorityCount = cards.deadlines ?? deadlines.filter((d) => !d.done).length ?? 4;
  const nextMeeting = meetings[0];
  const appPct = Math.round((progress.collegeList + progress.essays + progress.profile) / 3);

  const reach = 4;
  const target = 5;
  const safety = 3;

  return (
    <div className="dash-product-overview">
      <header className="dash-product-greeting">
        <div>
          <h1 className="dash-product-greeting__title">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="dash-product-greeting__sub">
            You have <strong>{priorityCount} priorities</strong> today.
          </p>
        </div>
        <div className="dash-product-greeting__actions">
          <span className="dash-product-greeting__date">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Link to={`${STUDENT_DASHBOARD_BASE}/calendar`} className="dash-product-greeting__cta">
            Weekly view <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="dash-product-split">
        <section className="dash-product-split__visual" aria-label="Admissions calendar">
          <AdmissionsCalendarVisual deadlines={deadlines} meetings={meetings} />
        </section>

        <section className="dash-product-split__cards" aria-label="Dashboard summary">
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
              <div><span>{progress.profile}%</span><small>Profile</small></div>
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

          <article className="dash-product-card dash-product-card--highlight">
            <header className="dash-product-card__head">
              <div>
                <p className="dash-product-card__eyebrow">Mentor Meeting</p>
                <h3 className="dash-product-card__title">Next session</h3>
              </div>
              <Video className="h-5 w-5" aria-hidden="true" />
            </header>
            {nextMeeting ? (
              <div className="dash-product-meeting">
                <Avatar name={mentor?.name} size="lg" />
                <div>
                  <p className="dash-product-meeting__name">{mentor?.name}</p>
                  <p className="dash-product-meeting__time">
                    {new Date(nextMeeting.startTime).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                    {" · "}
                    {new Date(nextMeeting.startTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <DashBadge variant="zoom">Zoom</DashBadge>
                </div>
              </div>
            ) : (
              <p className="dash-product-card__muted">No meeting scheduled yet.</p>
            )}
            <Link to={`${STUDENT_DASHBOARD_BASE}/calendar`} className="dash-product-card__link">
              Schedule meeting <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>

          <article className="dash-product-card">
            <header className="dash-product-card__head">
              <div>
                <p className="dash-product-card__eyebrow">AI Insights</p>
                <h3 className="dash-product-card__title">Prelude AI</h3>
              </div>
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            </header>
            <InsightList
              items={aiSuggestions.length ? aiSuggestions : ["Focus on your personal statement this week.", "Add one reach school with strong CS programs."]}
              actionLink={`${STUDENT_DASHBOARD_BASE}/ai`}
              actionLabel="Ask Prelude AI"
            />
          </article>

          <article className="dash-product-card dash-product-card--feed">
            <header className="dash-product-card__head">
              <div>
                <p className="dash-product-card__eyebrow">Activity Feed</p>
                <h3 className="dash-product-card__title">Recent updates</h3>
              </div>
              <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
            </header>
            <ActivityFeed items={gamification?.activityFeed ?? []} />
          </article>

          <article className="dash-product-card dash-product-card--compact">
            <header className="dash-product-card__head">
              <div>
                <p className="dash-product-card__eyebrow">Essays</p>
                <h3 className="dash-product-card__title">In progress</h3>
              </div>
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            </header>
            <ProgressBar label="Personal statement" value={progress.essays} />
            <ProgressBar label="Supplements" value={Math.max(progress.essays - 12, 20)} />
            <Link to={`${STUDENT_DASHBOARD_BASE}/workspace`} state={{ workspaceTab: "essays" }} className="dash-product-card__link">
              Open essay workspace <TrendingUp className="h-4 w-4" />
            </Link>
          </article>
        </section>
      </div>
    </div>
  );
}
