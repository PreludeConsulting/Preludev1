import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import {
  DASHBOARD_PHASE,
  getDashboardPhase,
  getPhaseHeaderLabel
} from "../../config/studentDashboardByGrade.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";
import ApplicationDashboardCards from "./ApplicationDashboardCards.jsx";
import PrepDashboardCards from "./PrepDashboardCards.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function StudentOverviewProduct() {
  const { user } = useAuth();
  const {
    profile,
    meetings,
    mentor,
    events,
    aiSuggestions,
    deadlines,
    applicationProgress,
    academicProgress,
    opportunities,
    studentProfileStats,
    essayTracker,
    financialAidTracker
  } = useDashboardData();

  const firstName = user?.name?.split(" ")[0] || "Jordan";
  const phase = getDashboardPhase(profile);
  const phaseLabel = getPhaseHeaderLabel(profile);
  const isPrep = phase === DASHBOARD_PHASE.PREPARATION;
  const [upcomingEventsMountEl, setUpcomingEventsMountEl] = useState(null);

  return (
    <div className="dash-product-overview">
      <header className="dash-product-greeting">
        <div>
          <h1 className="dash-product-greeting__title">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="dash-product-greeting__phase">{phaseLabel}</p>
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

      <div className={cn("dash-product-split", isPrep && "dash-product-split--prep")}>
        <section className="dash-product-split__visual" aria-label={isPrep ? "Calendar" : "Admissions timeline"}>
          <AdmissionsCalendarVisual
            deadlines={deadlines}
            meetings={meetings}
            events={events}
            mentorName={mentor?.name}
            showUpcomingEvents={isPrep}
            upcomingEventsPlacement={isPrep ? "external" : "inline"}
            upcomingEventsMountEl={isPrep ? upcomingEventsMountEl : null}
          />
        </section>

        {isPrep ? <div ref={setUpcomingEventsMountEl} className="dash-product-split__upcoming" /> : null}

        <section className="dash-product-split__cards" aria-label="Dashboard summary">
          {isPrep ? (
            <PrepDashboardCards
              academicProgress={academicProgress}
              opportunities={opportunities}
              profile={profile}
              studentProfileStats={studentProfileStats}
            />
          ) : (
            <ApplicationDashboardCards
              applicationProgress={applicationProgress}
              essayTracker={essayTracker}
              financialAidTracker={financialAidTracker}
              aiSuggestions={aiSuggestions}
            />
          )}
        </section>
      </div>
    </div>
  );
}
