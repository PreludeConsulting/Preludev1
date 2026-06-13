import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getPhaseHeaderLabel } from "../../config/studentDashboardByGrade.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";
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
    deadlines,
    academicProgress,
    opportunities,
    studentProfileStats
  } = useDashboardData();

  const firstName = user?.name?.split(" ")[0] || "there";
  const phaseLabel = getPhaseHeaderLabel(profile);
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

      <div className={cn("dash-product-split", "dash-product-split--prep")}>
        <section className="dash-product-split__visual" aria-label="Calendar">
          <AdmissionsCalendarVisual
            deadlines={deadlines}
            meetings={meetings}
            events={events}
            mentorName={mentor?.name}
            showUpcomingEvents
            upcomingEventsPlacement="external"
            upcomingEventsMountEl={upcomingEventsMountEl}
          />
        </section>

        <div ref={setUpcomingEventsMountEl} className="dash-product-split__upcoming" />

        <section className="dash-product-split__cards" aria-label="Dashboard summary">
          <PrepDashboardCards
            academicProgress={academicProgress}
            opportunities={opportunities}
            profile={profile}
            studentProfileStats={studentProfileStats}
          />
        </section>
      </div>
    </div>
  );
}
