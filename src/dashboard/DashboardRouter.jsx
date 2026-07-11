import { lazy, Suspense, useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardHomeForUser, MENTOR_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import DashboardLayout from "./components/DashboardLayout.jsx";
import RoleGuard from "./components/RoleGuard.jsx";
import { MENTOR_NAV } from "./config/navConfig.js";
import { PRODUCT_STUDENT_NAV } from "./config/productNav.js";
import { STUDENT_ROUTE_META, MENTOR_ROUTE_META } from "./config/routeMeta.js";
import { DashboardDataProvider } from "./context/DashboardDataContext.jsx";
import StudentGamificationShell from "./components/StudentGamificationShell.jsx";
const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const StudentAI = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentAI");
const StudentCalendar = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentCalendar");
const StudentColleges = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentColleges");
const StudentMentor = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentMentor");
const StudentMessages = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentMessages");
const StudentOverview = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentOverview");
const StudentProfileStats = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentProfileStats");
const StudentProgressRewards = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentProgressRewards");
const StudentWorkspace = lazyNamed(() => import("./pages/student/StudentPages.jsx"), "StudentWorkspace");
const MentorAvailability = lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorAvailability");
const MentorCalendar = lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorCalendar");
const MentorMessages = lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorMessages");
const MentorOverview = lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorOverview");
const MentorStudents = lazyNamed(() => import("./pages/mentor/MentorPages.jsx"), "MentorStudents");
const ParentOverview = lazyNamed(() => import("./pages/parent/ParentPages.jsx"), "ParentOverview");
const ParentChildRoutes = lazyNamed(() => import("./pages/parent/ParentPages.jsx"), "ParentChildRoutes");
import MentorStudentDashboard from "./components/product/MentorStudentDashboard.jsx";
import { MentorSettingsPage, ParentSettingsPage, StudentSettingsPage } from "./pages/shared/SettingsPages.jsx";
import { PRODUCT_PARENT_NAV } from "./config/parentNav.js";
import { PARENT_ROUTE_META } from "./config/parentRouteMeta.js";
import { PARENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import {
  MentorHelp,
  MentorNotifications,
  ParentBilling,
  ParentHelp,
  ParentNotifications,
  StudentBilling,
  StudentHelp,
  StudentNotifications
} from "./pages/shared/FeaturePages.jsx";
import { PreludeMatchBrowsePage } from "./pages/shared/PreludeMatchPages.jsx";
import MatchingTeamPage from "./pages/admin/AdminPages.jsx";
import PromoCodesAdminPage from "./pages/admin/PromoCodesAdminPage.jsx";
import { ADMIN_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import { checkMatchingTeamAccess } from "../lib/mentorSelectionApi.js";
import { hasMatchingTeamAccess } from "../../shared/matchingTeamAccess.js";

function DashboardRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="dash-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardHomeForUser(user)} replace />;
}

function LegacyStudentRedirect({ to }) {
  return <Navigate to={to} replace />;
}

function MatchingTeamGuard({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      if (hasMatchingTeamAccess(user)) {
        setState({ loading: false, allowed: true });
        return;
      }
      try {
        await checkMatchingTeamAccess();
        if (!cancelled) setState({ loading: false, allowed: true });
      } catch {
        if (!cancelled) setState({ loading: false, allowed: false });
      }
    }
    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (state.loading) return <div className="dash-loading">Checking Matching Team access...</div>;
  if (!state.allowed) {
    return (
      <div className="dash-page dash-page--premium">
        <div className="dash-callout dash-callout--error" role="alert">
          <p>403 Forbidden. Matching Team access is required.</p>
        </div>
      </div>
    );
  }
  return children;
}

function StudentRoutes() {
  const { user } = useAuth();
  return (
    <DashboardDataProvider user={user}>
      <StudentGamificationShell user={user}>
        <Routes>
          <Route element={<DashboardLayout productNav={PRODUCT_STUDENT_NAV} basePath={STUDENT_DASHBOARD_BASE} routeMeta={STUDENT_ROUTE_META} />}>
            <Route path="overview" element={<StudentOverview />} />
            <Route path="calendar" element={<StudentCalendar />} />
            <Route path="colleges" element={<StudentColleges />} />
            <Route path="ai" element={<StudentAI />} />
            <Route path="workspace" element={<StudentWorkspace />} />
            <Route path="mentor" element={<StudentMentor />} />
            <Route path="prelude-match" element={<PreludeMatchBrowsePage />} />
            <Route path="messages" element={<StudentMessages />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="resources" element={<LegacyStudentRedirect to="help" />} />
            <Route path="billing" element={<StudentBilling />} />
            <Route path="help" element={<StudentHelp />} />
            <Route path="settings" element={<StudentSettingsPage />} />
            <Route path="profile-stats" element={<StudentProfileStats />} />
            <Route path="progress-rewards" element={<StudentProgressRewards />} />
            <Route path="matching" element={<MatchingTeamGuard><MatchingTeamPage /></MatchingTeamGuard>} />
            <Route path="profile" element={<LegacyStudentRedirect to="settings" />} />
            <Route path="mentor-matching" element={<LegacyStudentRedirect to="prelude-match" />} />
            <Route index element={<Navigate to="overview" replace />} />
          </Route>
        </Routes>
      </StudentGamificationShell>
    </DashboardDataProvider>
  );
}

function MentorRoutes() {
  const { user } = useAuth();
  return (
    <DashboardDataProvider user={user}>
      <Routes>
        <Route element={<DashboardLayout productNav={MENTOR_NAV} basePath={MENTOR_DASHBOARD_BASE} routeMeta={MENTOR_ROUTE_META} />}>
          <Route path="overview" element={<MentorOverview />} />
          <Route path="calendar" element={<MentorCalendar />} />
          <Route path="students" element={<MentorStudents />} />
          <Route path="students/:studentId/*" element={<MentorStudentDashboard />} />
          <Route path="messages" element={<MentorMessages />} />
          <Route path="notifications" element={<MentorNotifications />} />
          <Route path="availability" element={<MentorAvailability />} />
          <Route path="settings" element={<MentorSettingsPage />} />
          <Route path="profile" element={<Navigate to="settings" replace />} />
          <Route path="billing" element={<Navigate to="settings" replace />} />
          <Route path="help" element={<MentorHelp />} />
          <Route path="matching" element={<MatchingTeamGuard><MatchingTeamPage /></MatchingTeamGuard>} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </DashboardDataProvider>
  );
}

function ParentRoutes() {
  const { user } = useAuth();
  return (
    <DashboardDataProvider user={user}>
      <Routes>
        <Route element={<DashboardLayout productNav={PRODUCT_PARENT_NAV} basePath={PARENT_DASHBOARD_BASE} routeMeta={PARENT_ROUTE_META} />}>
          <Route path="overview" element={<ParentOverview />} />
          <Route path="children" element={<ParentOverview />} />
          <Route path="children/:childId/*" element={<ParentChildRoutes />} />
          <Route path="notifications" element={<ParentNotifications />} />
          <Route path="settings" element={<ParentSettingsPage />} />
          <Route path="profile" element={<Navigate to="settings" replace />} />
          <Route path="billing" element={<ParentBilling />} />
          <Route path="help" element={<ParentHelp />} />
          <Route path="matching" element={<MatchingTeamGuard><MatchingTeamPage /></MatchingTeamGuard>} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </DashboardDataProvider>
  );
}

function AdminRoutes() {
  const { user } = useAuth();
  return (
    <DashboardDataProvider user={user}>
      <Routes>
        <Route element={<DashboardLayout productNav={[{ to: "/matching", label: "Matching", icon: UserCheck }, { to: "/promo-codes", label: "Promo codes", icon: UserCheck }]} basePath={ADMIN_DASHBOARD_BASE} routeMeta={{}} />}>
          <Route path="matching" element={<MatchingTeamGuard><MatchingTeamPage /></MatchingTeamGuard>} />
          <Route path="promo-codes" element={<PromoCodesAdminPage />} />
          <Route path="mentor-review" element={<Navigate to="../matching" replace />} />
          <Route index element={<Navigate to="matching" replace />} />
        </Route>
      </Routes>
    </DashboardDataProvider>
  );
}

/**
 * Routes are RELATIVE to the parent /dashboard/* match in main.jsx.
 * Do not prefix with /student — that would match /student/* at the site root instead.
 */
export default function DashboardRouter() {
  return (
    <Suspense fallback={<div className="dash-loading" role="status">Loading dashboard…</div>}>
    <Routes>
      <Route index element={<DashboardRedirect />} />
      <Route
        path="student/*"
        element={
          <RoleGuard role="student">
            <StudentRoutes />
          </RoleGuard>
        }
      />
      <Route
        path="mentor/*"
        element={
          <RoleGuard role="mentor">
            <MentorRoutes />
          </RoleGuard>
        }
      />
      <Route
        path="parent/*"
        element={
          <RoleGuard role="parent">
            <ParentRoutes />
          </RoleGuard>
        }
      />
      <Route
        path="admin/*"
        element={
          <RoleGuard role="admin">
            <AdminRoutes />
          </RoleGuard>
        }
      />
    </Routes>
    </Suspense>
  );
}
