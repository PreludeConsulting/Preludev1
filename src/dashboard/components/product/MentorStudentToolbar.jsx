import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";

export default function MentorStudentToolbar() {
  return (
    <div className="dash-mentor-student-toolbar">
      <Link to={`${MENTOR_DASHBOARD_BASE}/students`} className="dash-mentor-student-toolbar__back">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Students
      </Link>
    </div>
  );
}
