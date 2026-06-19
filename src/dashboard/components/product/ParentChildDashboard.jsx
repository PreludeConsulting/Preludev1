import { useMemo } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { DashboardDataProvider } from "../../context/DashboardDataContext.jsx";
import StudentGamificationShell from "../StudentGamificationShell.jsx";
import { PARENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { PARENT_CHILD_NAV } from "../../config/parentNav.js";
import StudentOverviewProduct from "./StudentOverviewProduct.jsx";
import { StudentCalendar } from "../../pages/student/StudentPages.jsx";

function ParentChildNav({ childId }) {
  const base = `${PARENT_DASHBOARD_BASE}/children/${childId}`;
  return (
    <nav className="dash-parent-child-nav" aria-label="Student sections">
      {PARENT_CHILD_NAV.map(({ to, label }) => (
        <Link key={to} to={`${base}/${to}`} className="dash-parent-child-nav__link">
          {label}
        </Link>
      ))}
    </nav>
  );
}

function ParentChildRoutesInner({ child }) {
  return (
    <div className="dash-parent-child-dashboard">
      <div className="dash-parent-viewing-banner">
        <p>
          Viewing <strong>{child.name}</strong>&apos;s dashboard — you can add and edit calendar events, but not remove them.
        </p>
        <Link to={`${PARENT_DASHBOARD_BASE}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
          Back to all students
        </Link>
      </div>
      <ParentChildNav childId={child.id} />
      <div className="dash-parent-child-dashboard__content">
        <Routes>
          <Route path="overview" element={<StudentOverviewProduct />} />
          <Route path="calendar" element={<StudentCalendar />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function ParentChildDashboard({ child, studentUser }) {
  const overrides = useMemo(
    () => ({
      deleteCalendarItem: async () => {
        throw new Error("Parents cannot remove calendar events.");
      }
    }),
    []
  );

  return (
    <DashboardDataProvider
      user={studentUser}
      overrides={overrides}
      parentViewStudent={child}
    >
      <StudentGamificationShell user={studentUser}>
        <ParentChildRoutesInner child={child} />
      </StudentGamificationShell>
    </DashboardDataProvider>
  );
}
