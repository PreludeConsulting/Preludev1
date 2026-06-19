import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Mail, Users } from "lucide-react";
import AppLink from "../AppLink.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { dashboardPathForRole, userNeedsParentInviteStep } from "../../lib/onboardingRoutes.js";
import { inviteParent, markParentInviteStepComplete } from "../../lib/parentLinks.js";

export default function ParentInviteOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [parentEmail, setParentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!ready) {
    return <main className="pm-onboarding-page"><p className="text-muted-foreground">Loading…</p></main>;
  }

  if (!user || user.role !== "student") {
    return <Navigate to={dashboardPathForRole(user?.role || "student")} replace />;
  }

  if (!userNeedsParentInviteStep(user)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  async function finish(destination) {
    await markParentInviteStepComplete(user.id);
    navigate(destination, { replace: true });
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
    <main className="pm-onboarding-page">
      <div className="pm-onboarding-page__inner">
        <AppLink href="/" className="pm-onboarding-page__back">← Back to Prelude</AppLink>
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">Almost done</p>
          <h1 className="pm-onboarding-page__title">Invite a parent or guardian</h1>
          <p className="pm-onboarding-page__sub">
            Prelude can send your parent a read-only summary of your progress, calendar, and mentor updates.
          </p>
        </header>

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
                <p className="dash-muted">You can add or update parent emails anytime in Settings.</p>
                <button
                  type="button"
                  className="pm-btn pm-btn--primary pm-btn--lg"
                  onClick={() => finish(dashboardPathForRole(user.role))}
                >
                  Continue to dashboard
                </button>
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
                {error ? <p className="dash-delete-account__error">{error}</p> : null}
                <div className="dash-parent-invite-form__actions">
                  <button type="submit" className="pm-btn pm-btn--primary" disabled={loading}>
                    {loading ? "Sending…" : "Send invitation"}
                  </button>
                  <button
                    type="button"
                    className="pm-btn pm-btn--ghost"
                    disabled={loading}
                    onClick={() => finish(dashboardPathForRole(user.role))}
                  >
                    Skip for now
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
