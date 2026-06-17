import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import MessagesPanel from "../../components/MessagesPanel.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import MentorAvailabilityProduct from "../../components/product/MentorAvailabilityProduct.jsx";
import MentorMeetingsProduct from "../../components/product/MentorMeetingsProduct.jsx";
import MentorOverviewProduct from "../../components/product/MentorOverviewProduct.jsx";
import MentorStudentsProduct from "../../components/product/MentorStudentsProduct.jsx";

export function MentorOverview() {
  return <MentorOverviewProduct />;
}

export function MentorCalendar() {
  return <MentorMeetingsProduct />;
}

export function MentorStudents() {
  return <MentorStudentsProduct />;
}

export function MentorMessages() {
  const { conversations, meetings } = useDashboardData();
  return (
    <div className="dash-page dash-page--flush">
      <MessagesPanel
        conversations={conversations}
        meetings={meetings}
        schedulePath={`${MENTOR_DASHBOARD_BASE}/calendar`}
        placeholder="Reply to student…"
      />
    </div>
  );
}

export function MentorAvailability() {
  return <MentorAvailabilityProduct />;
}
