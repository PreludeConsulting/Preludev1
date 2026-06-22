import { useMemo } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { DashboardDataProvider } from "../../context/DashboardDataContext.jsx";
import StudentGamificationShell from "../StudentGamificationShell.jsx";
import { PARENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { PARENT_CHILD_NAV } from "../../config/parentNav.js";
import StudentOverviewProduct from "./StudentOverviewProduct.jsx";
import { StudentCalendar } from "../../pages/student/StudentPages.jsx";

function ParentChildSwitcher({ allChildren, currentChildId }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!allChildren || allChildren.length <= 1) return null;

  return (
    <div className="dash-parent-child-switcher">
      <label className="dash-parent-child-switcher__label" htmlFor="parent-child-switcher">
        Viewing child
      </label>
      <select
        id="parent-child-switcher"
        className="dash-parent-child-switcher__select"
        value={currentChildId}
        onChange={(event) => {
          const nextId = event.target.value;
          if (!nextId || nextId === currentChildId) return;
          const suffix = location.pathname.split(`/children/${currentChildId}`)[1] || "/overview";
          navigate(`${PARENT_DASHBOARD_BASE}/children/${nextId}${suffix}`);
        }}
      >
        {allChildren.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ParentChildNav({ childId }) {
  const location = useLocation();
  const base = `${PARENT_DASHBOARD_BASE}/children/${childId}`;
  return (
    <nav className="dash-parent-child-nav" aria-label="Student sections">
      {PARENT_CHILD_NAV.map(({ to, label }) => {
        const href = `${base}/${to}`;
        const active = location.pathname.startsWith(href);
        return (
          <Link
            key={to}
            to={href}
            className={`dash-parent-child-nav__link${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function ParentChildRoutesInner({ child, allChildren }) {
  return (
    <div className="dash-parent-child-dashboard">
      <div className="dash-parent-viewing-banner">
        <div className="dash-parent-viewing-banner__main">
          <p>
            Viewing <strong>{child.name}</strong>&apos;s dashboard — you can add and edit calendar events, but not remove them.
          </p>
          <ParentChildSwitcher allChildren={allChildren} currentChildId={child.id} />
        </div>
        <Link to={`${PARENT_DASHBOARD_BASE}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
          Back to all children
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

export default function ParentChildDashboard({ child, allChildren = [], studentUser }) {
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
        <ParentChildRoutesInner child={child} allChildren={allChildren} />
      </StudentGamificationShell>
    </DashboardDataProvider>
  );
}
