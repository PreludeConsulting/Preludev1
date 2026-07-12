import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import MentorPendingRequestsPanel from "./MentorPendingRequestsPanel.jsx";
import MentorApplicationReviewsPanel from "./MentorApplicationReviewsPanel.jsx";

function AssignedStudentRow({ student }) {
  const streak = student.gamification?.streak ?? 0;

  return (
    <article className="dash-mentor-student-row">
      <div className="dash-mentor-student-row__body">
        <div className="dash-mentor-student-row__top">
          <h4 className="dash-mentor-student-row__name">{student.name}</h4>
          <span className="dash-mentor-student-row__grade">{student.grade}</span>
        </div>
        <div className="dash-mentor-student-row__facts">
          <span className="dash-mentor-student-row__streak">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {streak}-day streak
          </span>
          <span>Next meeting · {student.nextMeeting || "TBD"}</span>
          <span>{student.upcomingDeadlines ?? 0} deadline{(student.upcomingDeadlines ?? 0) === 1 ? "" : "s"}</span>
        </div>
      </div>
      <Link
        to={`${MENTOR_DASHBOARD_BASE}/students/${student.id}/overview`}
        className="dash-btn dash-btn--secondary dash-btn--sm"
      >
        View Student
      </Link>
    </article>
  );
}

function AssignedStudentsCard({ students }) {
  const previewStudents = students.slice(0, 4);

  return (
    <article className="dash-product-card dash-product-card--mentor-students">
      <header className="dash-product-card__head">
        <p className="dash-product-card__eyebrow">Assigned students</p>
        <h3 className="dash-product-card__title">Your students</h3>
        <Link to={`${MENTOR_DASHBOARD_BASE}/students`} className="dash-product-card__link">
          View all
        </Link>
      </header>
      <div className="dash-mentor-students">
        {previewStudents.map((student) => (
          <AssignedStudentRow key={student.id} student={student} />
        ))}
      </div>
    </article>
  );
}

function AvailabilitySummaryCard({ availability }) {
  const openSlots = availability.filter((slot) => slot.active);

  return (
    <article className="dash-product-card dash-product-card--mentor-availability">
      <header className="dash-product-card__head">
        <p className="dash-product-card__eyebrow">Schedule</p>
        <h3 className="dash-product-card__title">Availability summary</h3>
        <Link to={`${MENTOR_DASHBOARD_BASE}/availability`} className="dash-product-card__link">
          Edit availability
        </Link>
      </header>
      {openSlots.length ? (
        <div className="dash-mentor-avail-grid">
          {openSlots.map((slot) => (
            <article key={slot.id} className="dash-mentor-avail-mini">
              <span className="dash-mentor-avail-mini__day">{slot.day}</span>
              <span className="dash-mentor-avail-mini__time">{slot.time}</span>
              <span className="dash-mentor-avail-mini__status dash-mentor-avail-mini__status--open">Open</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="dash-product-card__muted">No open availability slots.</p>
      )}
      <p className="dash-mentor-avail-note">Open slots are for texting and extra help between meetings.</p>
    </article>
  );
}

export default function MentorDashboardCards({ students, availability, pendingRequests }) {
  return (
    <>
      <MentorPendingRequestsPanel requests={pendingRequests} />
      <MentorApplicationReviewsPanel />
      <AssignedStudentsCard students={students} />
      <AvailabilitySummaryCard availability={availability} />
    </>
  );
}
