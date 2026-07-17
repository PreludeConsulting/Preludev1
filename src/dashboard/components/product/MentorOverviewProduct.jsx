import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, ChevronRight } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { buildMentorCalendarExtras } from "../../lib/mentorCalendarFeed.js";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";
import MentorDashboardCards from "./MentorDashboardCards.jsx";
import MentorActivitiesPanel from "./MentorActivitiesPanel.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function MentorOverviewProduct() {
  const { user } = useAuth();
  const {
    meetings,
    students,
    availability,
    pendingRequests,
    events,
    mentor
  } = useDashboardData();

  const firstName = user?.name?.split(" ")[0] || "there";
  const [upcomingEventsMountEl, setUpcomingEventsMountEl] = useState(null);

  const calendarEvents = useMemo(
    () => [
      ...events,
      ...buildMentorCalendarExtras({ pendingRequests, availability, students })
    ],
    [events, pendingRequests, availability, students]
  );

  return (
    <div className="dash-product-overview dash-product-overview--mentor">
      <header className="dash-product-greeting">
        <div>
          <h1 className="dash-product-greeting__title">
            {greetingForHour(new Date().getHours())}, {firstName}
          </h1>
          <p className="dash-product-greeting__phase">
            {students.length} student{students.length === 1 ? "" : "s"} assigned · Mentor dashboard
          </p>
        </div>
        <div className="dash-product-greeting__actions">
          <span className="dash-product-greeting__date">
            <Calendar className="h-4 w-4" />
            {new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Link to={`${MENTOR_DASHBOARD_BASE}/calendar`} className="dash-product-greeting__cta">
            Meetings <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className={cn("dash-product-split", "dash-product-split--mentor")}>
        <div className="dash-product-split__calendar-stack">
          <section className="dash-product-split__visual" aria-label="Calendar">
            <AdmissionsCalendarVisual
              meetings={meetings}
              events={calendarEvents}
              students={students}
              mentorName={mentor?.name}
              role="mentor"
              mentorView
              showUpcomingEvents
              upcomingEventsPlacement="external"
              upcomingEventsMountEl={upcomingEventsMountEl}
              upcomingTitle="Upcoming Meetings"
            />
          </section>

          <div ref={setUpcomingEventsMountEl} className="dash-product-split__upcoming" />
        </div>

        <section className="dash-product-split__cards" aria-label="Mentor dashboard summary">
          <MentorDashboardCards
            students={students}
            availability={availability}
            pendingRequests={pendingRequests}
          />
        </section>
      </div>

      <MentorActivitiesPanel />
    </div>
  );
}
