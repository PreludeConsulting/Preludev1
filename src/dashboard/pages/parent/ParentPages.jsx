import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PARENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getDemoLinkedChildren, listLinkedChildren } from "../../../lib/parentLinks.js";
import { shouldUseDemoFixtures } from "../../../lib/devAuthBypass.js";
import { resolveStudentAuthUser } from "../../lib/studentDemoBundle.js";
import ParentChildDashboard from "../../components/product/ParentChildDashboard.jsx";
import { Avatar, EmptyState, SectionCard } from "../../components/ui/index.jsx";

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
          if (!cancelled) setChildren(getDemoLinkedChildren());
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
        <p className="dash-muted">Follow your children&apos;s college journey with a simplified Prelude view.</p>
      </header>

      <SectionCard title="Your children" className="dash-panel">
        {loading ? <p className="dash-muted" role="status" aria-live="polite">Loading linked children…</p> : null}
        {!loading && !children.length ? (
          <EmptyState
            icon={Users}
            title="No children linked yet"
            description="Ask your student to invite you from Prelude Settings → Family, or enter your email when they sign up."
          />
        ) : null}
        <ul className="dash-parent-children-list">
          {children.map((child) => (
            <li key={child.id}>
              <Link to={`${PARENT_DASHBOARD_BASE}/children/${child.id}/overview`} className="dash-parent-child-card">
                <Avatar name={child.name} avatarUrl={child.avatarUrl} size="sm" />
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
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (shouldUseDemoFixtures(user)) {
          if (!cancelled) setChildren(getDemoLinkedChildren());
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

  const child = useMemo(() => children.find((c) => c.id === childId) || null, [children, childId]);

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

  if (loading) {
    return (
      <div className="dash-page">
        <p className="dash-muted" role="status" aria-live="polite">Loading student…</p>
      </div>
    );
  }

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

  return <ParentChildDashboard child={child} allChildren={children} studentUser={studentUser} />;
}
