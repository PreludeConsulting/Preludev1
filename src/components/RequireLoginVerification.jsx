import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function RequireLoginVerification({ children }) {
  const { user, ready, verificationRequired, loginVerificationLoading } = useAuth();
  const location = useLocation();

  if (!ready || loginVerificationLoading) {
    return (
      <div className="dash-loading">
        <p>Checking your Prelude session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (verificationRequired) {
    return <Navigate to={`/verify-login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
}
