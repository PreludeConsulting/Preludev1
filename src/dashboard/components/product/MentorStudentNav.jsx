import { NavLink, useParams } from "react-router-dom";
import { cn } from "../../../lib/utils.js";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { MENTOR_STUDENT_NAV } from "../../config/mentorStudentNav.js";

export default function MentorStudentNav() {
  const { studentId } = useParams();
  const basePath = `${MENTOR_DASHBOARD_BASE}/students/${studentId}`;

  return (
    <nav className="dash-mentor-student-nav" aria-label="Student dashboard sections">
      <div className="dash-product-nav__tabs dash-mentor-student-nav__tabs">
        {MENTOR_STUDENT_NAV.map(({ to, label, icon: Icon, end, workspaceTab }) => (
          <NavLink
            key={to}
            to={workspaceTab ? `${basePath}/${to}?tab=${workspaceTab}` : `${basePath}/${to}`}
            end={end}
            className={({ isActive }) => cn("dash-product-nav__tab", isActive && "dash-product-nav__tab--active")}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
