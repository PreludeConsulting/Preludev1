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
  StudentWorkspace
} from "./pages/student/StudentPages.jsx";
import {
  MentorAvailability,
  MentorCalendar,
  MentorMessages,
  MentorOverview,
  MentorStudentDetail,
  MentorStudents
} from "./pages/mentor/MentorPages.jsx";
import { MentorSettingsPage, StudentSettingsPage } from "./pages/shared/SettingsPages.jsx";
import {
  MentorBilling,
  MentorHelp,
  MentorNotifications,
  StudentBilling,
  StudentHelp,
  StudentNotifications,
  StudentResources
} from "./pages/shared/FeaturePages.jsx";
import { PreludeMatchBrowsePage } from "./pages/shared/PreludeMatchPages.jsx";

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
          <Route path="students/:studentId" element={<MentorStudentDetail />} />
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
    </Routes>
  );
}
