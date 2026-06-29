import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { settingsPathForRole } from "../lib/onboardingRoutes.js";
import RequireLoginVerification from "./RequireLoginVerification.jsx";

function InnerSecuritySettingsRedirect() {
  const { user } = useAuth();
  return <Navigate to={`${settingsPathForRole(user?.role || "student")}#security`} replace />;
}

export default function SecuritySettingsRedirect() {
  return (
    <RequireLoginVerification>
      <InnerSecuritySettingsRedirect />
    </RequireLoginVerification>
  );
}
