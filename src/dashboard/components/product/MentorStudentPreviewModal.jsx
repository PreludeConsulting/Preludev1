import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getPhaseHeaderLabel } from "../../config/studentDashboardByGrade.js";
import { getStudentDemoBundleBySlug } from "../../lib/studentDemoBundle.js";
import { Modal, SecondaryButton } from "../ui/index.jsx";
import PrepDashboardCards from "./PrepDashboardCards.jsx";

function greetingForHour(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export default function MentorStudentPreviewModal({ student, open, onClose }) {
  const bundle = useMemo(
    () => (student?.id ? getStudentDemoBundleBySlug(student.id) : null),
    [student?.id]
  );

  if (!student) return null;

  const firstName = student.name?.split(" ")[0] || "Student";
  const phaseLabel = bundle?.profile
    ? getPhaseHeaderLabel(bundle.profile)
    : `${student.grade} · ${student.major || "Student"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${student.name}'s dashboard`}
      className="dash-modal--mentor-student-preview"
      scrollable
      footer={<SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>}
    >
      <div className="dash-mentor-student-preview">
        <header className="dash-product-greeting dash-product-greeting--preview">
          <div>
            <h2 className="dash-product-greeting__title">
              {greetingForHour(new Date().getHours())}, {firstName}
            </h2>
            <p className="dash-product-greeting__phase">{phaseLabel}</p>
          </div>
        </header>

        {bundle ? (
          <div className="dash-mentor-student-preview__cards">
            <PrepDashboardCards
              academicProgress={bundle.academicProgress}
              opportunities={bundle.opportunities}
              profile={bundle.profile}
              studentProfileStats={bundle.studentProfileStats}
            />
          </div>
        ) : (
          <p className="dash-product-card__muted">Student preview is unavailable for this profile.</p>
        )}

        <div className="dash-mentor-student-preview__footer">
          <Link to={`${MENTOR_DASHBOARD_BASE}/students/${student.id}`} className="dash-btn dash-btn--secondary dash-btn--sm">
            Open full student profile
          </Link>
        </div>
      </div>
    </Modal>
  );
}
