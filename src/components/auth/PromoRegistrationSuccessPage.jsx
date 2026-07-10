import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "./AuthLayout.jsx";
import { AuthSubmitButton } from "./AuthForm.jsx";
import { postAuthDestination } from "../../lib/onboardingRoutes.js";
import { useAuth } from "../../context/AuthContext.jsx";

export function PromoRegistrationSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready, refreshUser } = useAuth();
  const state = location.state || {};
  const email = state.email || user?.email || "";
  const summary = state.summary || null;
  const planLabel = summary?.plan || "Plus";
  const [destination, setDestination] = useState("/onboarding/match");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const refreshed = (await refreshUser()) || user;
      if (!cancelled && refreshed) {
        setDestination(postAuthDestination(refreshed));
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, user]);

  if (!summary) {
    return <Navigate to="/register" replace />;
  }

  return (
    <AuthLayout
      title="Your account is ready"
      subtitle={`Your complimentary ${planLabel} Plan has been activated. No payment method was required.`}
      headerLink={{ prefix: "Need help?", label: "Contact support", href: "/contact" }}
    >
      <div className="promo-success-page" role="status">
        <CheckCircle2 className="promo-success-page__icon" aria-hidden="true" />
        <dl className="promo-code-field__summary promo-success-page__summary">
          <div><dt>Account email</dt><dd>{email}</dd></div>
          <div><dt>{planLabel} Plan status</dt><dd>Active — promotional access</dd></div>
          {summary.campaignName ? <div><dt>Promotion</dt><dd>{summary.campaignName}</dd></div> : null}
          <div><dt>Access period</dt><dd>{summary.accessPeriod}</dd></div>
          <div><dt>Renewal terms</dt><dd>{summary.renewalTerms}</dd></div>
        </dl>
        <AuthSubmitButton
          type="button"
          disabled={loading}
          onClick={() => navigate(ready && user ? destination : "/login", { replace: true })}
        >
          {loading ? "Preparing next step…" : "Continue setup"}
        </AuthSubmitButton>
      </div>
    </AuthLayout>
  );
}
