import { useMemo, useState } from "react";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { buildMentorCalendarExtras } from "../../lib/mentorCalendarFeed.js";
import AdmissionsCalendarVisual from "./AdmissionsCalendarVisual.jsx";
import MentorMeetingsHistorySection from "./MentorMeetingsHistorySection.jsx";
import MentorMeetingsLiveSection from "./MentorMeetingsLiveSection.jsx";
import MentorMeetingsRequestsSection from "./MentorMeetingsRequestsSection.jsx";
import MentorApplicationReviewsPanel from "./MentorApplicationReviewsPanel.jsx";

export default function MentorMeetingsProduct() {
  const {
    meetings,
    students,
    availability,
    pendingRequests,
    events,
    mentor
  } = useDashboardData();
  const [upcomingEventsMountEl, setUpcomingEventsMountEl] = useState(null);
  const [studentFilter, setStudentFilter] = useState("");

  const calendarEvents = useMemo(
    () => [
      ...events,
      ...buildMentorCalendarExtras({ pendingRequests, availability, students })
    ],
    [events, pendingRequests, availability, students]
  );

  return (
    <div className="dash-page dash-page--meetings">
      <div className="dash-meetings-layout">
        <div className="dash-meetings-layout__calendar">
          <AdmissionsCalendarVisual
            meetings={meetings}
            events={calendarEvents}
            students={students}
            mentorName={mentor?.name}
            role="mentor"
            mentorView
            showStudentFilter
            studentFilter={studentFilter}
            onStudentFilterChange={setStudentFilter}
            showUpcomingEvents
            upcomingEventsPlacement="external"
            upcomingEventsMountEl={upcomingEventsMountEl}
            upcomingTitle="Upcoming Events"
          />
        </div>
        <aside className="dash-meetings-layout__side">
          <MentorMeetingsLiveSection />
          <MentorMeetingsRequestsSection requests={pendingRequests} studentFilter={studentFilter} />
          <MentorApplicationReviewsPanel studentFilter={studentFilter} />
          <div ref={setUpcomingEventsMountEl} className="dash-meetings-layout__upcoming" />
          <MentorMeetingsHistorySection meetings={meetings} studentFilter={studentFilter} />
        </aside>
      </div>
    </div>
  );
}
