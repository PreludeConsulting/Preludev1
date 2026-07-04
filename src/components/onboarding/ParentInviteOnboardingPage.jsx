import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  MATCH_ONBOARDING_PATH,
  PAYMENT_ONBOARDING_PATH,
  dashboardPathForRole,
  userNeedsParentInviteStep
} from "../../lib/onboardingRoutes.js";
import { inviteParent, markParentInviteStepComplete } from "../../lib/parentLinks.js";
import OnboardingShell from "./OnboardingShell.jsx";

export default function ParentInviteOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready, refreshUser } = useAuth();
  const [parentEmail, setParentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!ready) {
    return (
      <OnboardingShell user={user} loading title="Invite a parent" subtitle="Loading your setup…" hideContinue />
    );
  }

  if (!user || user.role !== "student") {
    return <Navigate to={dashboardPathForRole(user?.role || "student")} replace />;
  }

  if (!userNeedsParentInviteStep(user)) {
    return <Navigate to={PAYMENT_ONBOARDING_PATH} replace />;
  }

  async function finish() {
    setError("");
    setLoading(true);
    try {
      await markParentInviteStepComplete(user.id);
      await refreshUser();
      navigate(PAYMENT_ONBOARDING_PATH, { replace: true });
    } catch (err) {
      setError(err.message || "Could not finish this step. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await inviteParent({
        studentId: user.id,
        studentName: user.name,
        parentEmail
      });
      setSent(true);
    } catch (err) {
      setError(err.message || "Could not send the invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      user={user}
      title="Invite a parent or guardian"
      subtitle="Prelude can send your parent a read-only summary of your progress, calendar, and mentor updates."
      eyebrow="Almost there"
      backHref={`${MATCH_ONBOARDING_PATH}?step=result`}
      continueLabel="Next"
      continueDisabled={!sent}
      continueLoading={loading}
      continueHint={!sent ? "Send a parent invite or choose Skip for now to continue." : ""}
      useStepCompletionGate={false}
      onContinue={finish}
      footerNote="You can add or update parent emails anytime in Settings after checkout."
    >
      <div className="pm-card-wrap">
        <div className="pm-card-wrap__glow" aria-hidden="true" />
        <div className="pm-card pm-card--stable dash-parent-invite-card">
          <div className="dash-parent-invite-card__icon" aria-hidden="true">
            <Users className="h-6 w-6" />
          </div>
          <p className="dash-muted">
            We&apos;ll email them a secure link to create a Prelude parent account linked to yours.
          </p>

          {sent ? (
            <div className="dash-parent-invite-card__success">
              <p><strong>Invitation sent!</strong> We emailed <strong>{parentEmail}</strong>.</p>
              <p className="dash-muted">Next, choose your Prelude plan and complete secure checkout.</p>
            </div>
          ) : (
            <form className="dash-parent-invite-form" onSubmit={handleSend}>
              <label className="prelude-field">
                <span>Parent or guardian email</span>
                <div className="dash-parent-invite-form__input-wrap">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="parent@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </label>
              {error ? <p className="onboarding-flow__error" role="alert">{error}</p> : null}
              <div className="dash-parent-invite-form__actions">
                <button type="submit" className="pm-btn pm-btn--primary" disabled={loading}>
                  {loading ? "Sending…" : "Send invitation"}
                </button>
                <button
                  type="button"
                  className="pm-btn pm-btn--ghost"
                  disabled={loading}
                  onClick={finish}
                >
                  Skip for now
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}
