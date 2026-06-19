import { useMemo } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { DashboardDataProvider } from "../../context/DashboardDataContext.jsx";
import StudentGamificationShell from "../StudentGamificationShell.jsx";
import MentorStudentReadOnlyPage from "./MentorStudentReadOnlyPage.jsx";
import MentorStudentNav from "./MentorStudentNav.jsx";
import MentorStudentToolbar from "./MentorStudentToolbar.jsx";
import MentorViewingBanner from "./MentorViewingBanner.jsx";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { resolveStudentAuthUser } from "../../lib/studentDemoBundle.js";
import {
  StudentAI,
  StudentCalendar,
  StudentOverview,
  StudentProfileStats,
  StudentWorkspace
} from "../../pages/student/StudentPages.jsx";

function MentorStudentDashboardRoutes({ student, studentUser }) {
  return (
    <DashboardDataProvider user={studentUser} mentorViewStudent={student}>
      <StudentGamificationShell user={studentUser}>
        <div className="dash-mentor-student-dashboard">
          <MentorStudentToolbar />
          <MentorViewingBanner student={student} />
          <div className="dash-mentor-student-divider" role="separator" aria-hidden="true" />
          <p className="dash-mentor-student-section-label">Student Dashboard</p>
          <MentorStudentNav />
          <div className="dash-mentor-student-dashboard__content">
            <Routes>
              <Route path="overview" element={<StudentOverview />} />
              <Route path="calendar" element={<StudentCalendar />} />
              <Route
                path="workspace"
                element={(
                  <MentorStudentReadOnlyPage>
                    <StudentWorkspace />
                  </MentorStudentReadOnlyPage>
                )}
              />
              <Route
                path="ai"
                element={(
                  <MentorStudentReadOnlyPage>
                    <StudentAI />
                  </MentorStudentReadOnlyPage>
                )}
              />
              <Route
                path="profile-stats"
                element={(
                  <MentorStudentReadOnlyPage>
                    <StudentProfileStats />
                  </MentorStudentReadOnlyPage>
                )}
              />
              <Route index element={<Navigate to="overview" replace />} />
            </Routes>
          </div>
        </div>
      </StudentGamificationShell>
    </DashboardDataProvider>
  );
}

export default function MentorStudentDashboard() {
  const { studentId } = useParams();
  const { students } = useDashboardData();
  const student = students.find((item) => item.id === studentId);
  const studentUser = useMemo(
    () => (student ? resolveStudentAuthUser(student) : null),
    [student]
  );

  if (!student || !studentUser) {
    return (
      <div className="dash-page">
        <p className="dash-muted">This student is not assigned to your account.</p>
        <a href={`${MENTOR_DASHBOARD_BASE}/students`} className="dash-btn dash-btn--secondary dash-btn--sm">
          Back to Students
        </a>
      </div>
    );
  }

  return <MentorStudentDashboardRoutes student={student} studentUser={studentUser} />;
}
