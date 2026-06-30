import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthLoadingState from "./AuthLoadingState.jsx";

export default function RequireLoginVerification({ children }) {
  const { user, ready, verificationRequired, loginVerificationLoading } = useAuth();
  const location = useLocation();

  if (!ready || loginVerificationLoading) {
    return (
      <AuthLoadingState
        title="Checking your Prelude session"
        message="We are restoring your secure session before showing protected pages."
      />
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
