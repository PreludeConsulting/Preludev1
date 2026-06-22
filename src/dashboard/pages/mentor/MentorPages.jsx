import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import PreludeMessagesPage from "../../components/chat/PreludeMessagesPage.jsx";
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
  return (
    <div className="dash-page dash-page--flush">
      <PreludeMessagesPage
        schedulePath={`${MENTOR_DASHBOARD_BASE}/calendar`}
        placeholder="Reply to student or parent…"
      />
    </div>
  );
}

export function MentorAvailability() {
  return <MentorAvailabilityProduct />;
}
