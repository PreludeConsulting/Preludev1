import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardHomeForRole, MENTOR_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import DashboardLayout from "./components/DashboardLayout.jsx";
import RoleGuard from "./components/RoleGuard.jsx";
import { MENTOR_NAV } from "./config/navConfig.js";
import { PRODUCT_STUDENT_NAV } from "./config/productNav.js";
import { STUDENT_ROUTE_META, MENTOR_ROUTE_META } from "./config/routeMeta.js";
import { DashboardDataProvider } from "./context/DashboardDataContext.jsx";
import StudentGamificationShell from "./components/StudentGamificationShell.jsx";
import {
  StudentAI,
  StudentCalendar,
  StudentMentor,
  StudentMessages,
  StudentOverview,
  StudentProfileStats,
  StudentProgressRewards,
  StudentWorkspace
} from "./pages/student/StudentPages.jsx";
import {
  MentorAvailability,
  MentorCalendar,
  MentorMessages,
  MentorOverview,
  MentorStudents
} from "./pages/mentor/MentorPages.jsx";
import MentorStudentDashboard from "./components/product/MentorStudentDashboard.jsx";
import { MentorSettingsPage, ParentSettingsPage, StudentSettingsPage } from "./pages/shared/SettingsPages.jsx";
import { ParentOverview, ParentChildRoutes } from "./pages/parent/ParentPages.jsx";
import { PRODUCT_PARENT_NAV } from "./config/parentNav.js";
import { PARENT_ROUTE_META } from "./config/parentRouteMeta.js";
import { PARENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import {
  MentorBilling,
  MentorHelp,
  MentorNotifications,
  ParentBilling,
  ParentHelp,
  ParentNotifications,
  StudentBilling,
  StudentHelp,
  StudentNotifications,
  StudentResources
} from "./pages/shared/FeaturePages.jsx";
import { PreludeMatchBrowsePage } from "./pages/shared/PreludeMatchPages.jsx";
import AdminMentorReviewPage from "./pages/admin/AdminPages.jsx";
import { ADMIN_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";

function DashboardRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="dash-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardHomeForRole(user.role)} replace />;
}

function LegacyStudentRedirect({ to }) {
  return <Navigate to={to} replace />;
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
            <Route path="ai" element={<StudentAI />} />
            <Route path="workspace" element={<StudentWorkspace />} />
            <Route path="mentor" element={<StudentMentor />} />
            <Route path="prelude-match" element={<PreludeMatchBrowsePage />} />
            <Route path="messages" element={<StudentMessages />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="resources" element={<StudentResources />} />
            <Route path="billing" element={<StudentBilling />} />
            <Route path="help" element={<StudentHelp />} />
            <Route path="settings" element={<StudentSettingsPage />} />
            <Route path="profile-stats" element={<StudentProfileStats />} />
            <Route path="progress-rewards" element={<StudentProgressRewards />} />
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
          <Route path="billing" element={<MentorBilling />} />
          <Route path="help" element={<MentorHelp />} />
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
        <Route element={<DashboardLayout productNav={[]} basePath={ADMIN_DASHBOARD_BASE} routeMeta={{}} />}>
          <Route path="mentor-review" element={<AdminMentorReviewPage />} />
          <Route index element={<Navigate to="mentor-review" replace />} />
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
  );
}
