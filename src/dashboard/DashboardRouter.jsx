import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { dashboardHomeForRole, MENTOR_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../lib/dashboardRoutes.js";
import DashboardLayout from "./components/DashboardLayout.jsx";
import RoleGuard from "./components/RoleGuard.jsx";
import { STUDENT_NAV, MENTOR_NAV } from "./config/navConfig.js";
import { STUDENT_ROUTE_META, MENTOR_ROUTE_META } from "./config/routeMeta.js";
import { DashboardDataProvider } from "./context/DashboardDataContext.jsx";
import StudentGamificationShell from "./components/StudentGamificationShell.jsx";
import {
  StudentAI,
  StudentCalendar,
  StudentMentor,
  StudentMessages,
  StudentOverview,
  StudentProfileSettings,
  StudentProfileStats,
  StudentWorkspace
} from "./pages/student/StudentPages.jsx";
import {
  MentorAvailability,
  MentorCalendar,
  MentorMessages,
  MentorOverview,
  MentorProfileSettings,
  MentorStudentDetail,
  MentorStudents
} from "./pages/mentor/MentorPages.jsx";

function DashboardRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="dash-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardHomeForRole(user.role)} replace />;
}

function StudentRoutes() {
  const { user } = useAuth();
  return (
    <DashboardDataProvider user={user}>
      <StudentGamificationShell user={user}>
      <Routes>
        <Route element={<DashboardLayout navItems={STUDENT_NAV} basePath={STUDENT_DASHBOARD_BASE} routeMeta={STUDENT_ROUTE_META} />}>
          <Route path="overview" element={<StudentOverview />} />
          <Route path="calendar" element={<StudentCalendar />} />
          <Route path="ai" element={<StudentAI />} />
          <Route path="profile-stats" element={<StudentProfileStats />} />
          <Route path="workspace" element={<StudentWorkspace />} />
          <Route path="mentor" element={<StudentMentor />} />
          <Route path="messages" element={<StudentMessages />} />
          <Route path="profile" element={<StudentProfileSettings />} />
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
        <Route element={<DashboardLayout navItems={MENTOR_NAV} basePath={MENTOR_DASHBOARD_BASE} routeMeta={MENTOR_ROUTE_META} />}>
          <Route path="overview" element={<MentorOverview />} />
          <Route path="calendar" element={<MentorCalendar />} />
          <Route path="students" element={<MentorStudents />} />
          <Route path="students/:studentId" element={<MentorStudentDetail />} />
          <Route path="messages" element={<MentorMessages />} />
          <Route path="availability" element={<MentorAvailability />} />
          <Route path="profile" element={<MentorProfileSettings />} />
          <Route index element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </DashboardDataProvider>
  );
}

export default function DashboardRouter() {
  return (
    <Routes>
      <Route path="/" element={<DashboardRedirect />} />
      <Route
        path="/student/*"
        element={
          <RoleGuard role="student">
            <StudentRoutes />
          </RoleGuard>
        }
      />
      <Route
        path="/mentor/*"
        element={
          <RoleGuard role="mentor">
            <MentorRoutes />
          </RoleGuard>
        }
      />
    </Routes>
  );
}
