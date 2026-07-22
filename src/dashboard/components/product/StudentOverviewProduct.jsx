import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { MENTOR_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getPhaseHeaderLabel } from "../../config/studentDashboardByGrade.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";
import PrepDashboardCards from "./PrepDashboardCards.jsx";
import StudentMentorActivities from "./StudentMentorActivities.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function StudentOverviewProduct() {
  const { user } = useAuth();
  const { studentId } = useParams();
  const {
    profile,
    meetings,
    mentor,
    events,
    deadlines,
    studentProfileStats,
    isMentorStudentView,
    mentorViewStudent
  } = useDashboardData();

  const firstName = isMentorStudentView
    ? mentorViewStudent?.name?.split(" ")[0] || "there"
    : user?.name?.split(" ")[0] || "there";
  const phaseLabel = getPhaseHeaderLabel(profile);
  const [upcomingEventsMountEl, setUpcomingEventsMountEl] = useState(null);
  const calendarPath = isMentorStudentView
    ? `${MENTOR_DASHBOARD_BASE}/students/${studentId}/calendar`
    : `${STUDENT_DASHBOARD_BASE}/calendar`;

  return (
    <div className={cn("dash-product-overview", isMentorStudentView && "dash-product-overview--mentor-view")}>
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
          <Link to={calendarPath} className="dash-product-greeting__cta">
            Weekly view <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className={cn("dash-product-split", "dash-product-split--prep", isMentorStudentView && "dash-product-split--mentor-view")}>
        <div className="dash-product-split__calendar-stack">
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
        </div>

        <section
          className={cn("dash-product-split__cards", isMentorStudentView && "dash-mentor-view-readonly")}
          aria-label="Dashboard summary"
        >
          {!isMentorStudentView ? (
            <StudentMentorActivities className="dash-product-split__mentor-activities" />
          ) : null}
          <PrepDashboardCards
            profile={profile}
            studentProfileStats={studentProfileStats}
            showRewardsPreview={!isMentorStudentView}
          />
        </section>
      </div>
    </div>
  );
}
