import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PARENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { listLinkedChildren } from "../../../lib/parentLinks.js";
import { shouldUseDemoFixtures } from "../../../lib/devAuthBypass.js";
import { DEMO_STUDENT } from "../../../data/demoAccounts.js";
import { DEMO_SLUGS } from "../../../data/demoDashboardData.js";
import { resolveStudentAuthUser } from "../../lib/studentDemoBundle.js";
import ParentChildDashboard from "../../components/product/ParentChildDashboard.jsx";
import { SectionCard } from "../../components/ui/index.jsx";

function demoLinkedChildren() {
  return [
    {
      id: DEMO_SLUGS.jordan,
      name: `${DEMO_STUDENT.firstName} ${DEMO_STUDENT.lastName}`,
      grade: "11th grade",
      linkedAt: new Date().toISOString()
    }
  ];
}

export function ParentOverview() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (shouldUseDemoFixtures(user)) {
          if (!cancelled) setChildren(demoLinkedChildren());
          return;
        }
        const rows = await listLinkedChildren(user.id);
        if (!cancelled) setChildren(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="dash-page dash-page--premium dash-parent-overview">
      <header className="dash-parent-overview__head">
        <h1 className="dash-product-greeting__title">Welcome, {user?.name?.split(" ")[0] || "there"}</h1>
        <p className="dash-muted">Follow your student&apos;s college journey with a simplified Prelude view.</p>
      </header>

      <SectionCard title="Your students" className="dash-panel">
        {loading ? <p className="dash-muted">Loading linked students…</p> : null}
        {!loading && !children.length ? (
          <p className="dash-muted">
            No students linked yet. Ask your student to invite you from their Prelude Settings → Family tab.
          </p>
        ) : null}
        <ul className="dash-parent-children-list">
          {children.map((child) => (
            <li key={child.id}>
              <Link to={`${PARENT_DASHBOARD_BASE}/children/${child.id}/overview`} className="dash-parent-child-card">
                <span className="dash-parent-child-card__avatar" aria-hidden="true">
                  <Users className="h-5 w-5" />
                </span>
                <span className="dash-parent-child-card__text">
                  <strong>{child.name}</strong>
                  <span>{child.grade || "Student"}</span>
                </span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

export function ParentChildrenIndex() {
  return <Navigate to="../overview" replace />;
}

export function ParentChildRoutes() {
  const { childId } = useParams();
  const { user } = useAuth();
  const [child, setChild] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (shouldUseDemoFixtures(user)) {
        const demo = demoLinkedChildren().find((c) => c.id === childId);
        if (!cancelled) setChild(demo || null);
        return;
      }
      const rows = await listLinkedChildren(user.id);
      if (!cancelled) setChild(rows.find((c) => c.id === childId) || null);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, childId]);

  const studentUser = useMemo(() => {
    if (!child) return null;
    if (shouldUseDemoFixtures(user)) {
      return resolveStudentAuthUser({ id: child.id, name: child.name });
    }
    return {
      id: child.id,
      email: `${child.id}@linked.student`,
      name: child.name,
      role: "student",
      authProvider: "supabase"
    };
  }, [child, user]);

  if (!child || !studentUser) {
    return (
      <div className="dash-page">
        <p className="dash-muted">Student not found or not linked to your account.</p>
        <Link to={`${PARENT_DASHBOARD_BASE}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
          Back to home
        </Link>
      </div>
    );
  }

  return <ParentChildDashboard child={child} studentUser={studentUser} />;
}
