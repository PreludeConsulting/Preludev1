import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Mail, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  MATCH_ONBOARDING_PATH,
  dashboardPathForRole
} from "../../lib/onboardingRoutes.js";
import { markParentInviteStepComplete } from "../../lib/parentLinks.js";
import {
  peekPendingBundleIntent,
  pendingBundlePaymentPath
} from "../../lib/bundlePurchaseIntent.js";
import OnboardingShell from "./OnboardingShell.jsx";

export default function ParentInviteOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready, refreshUser } = useAuth();
  const [parentEmail, setParentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const finishingRef = useRef(false);

  if (!ready) {
    return (
      <OnboardingShell user={user} loading title="Invite a parent" subtitle="Loading your setup…" hideContinue />
    );
  }

  if (!user || user.role !== "student") {
    return <Navigate to={dashboardPathForRole(user?.role || "student")} replace />;
  }

  const stepAlreadyComplete = Boolean(user.parentInviteStepComplete);
  const canContinue = skipped || stepAlreadyComplete;

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setError("");
    setLoading(true);
    try {
      await markParentInviteStepComplete(user.id);
      const refreshedUser = await refreshUser();
      const destination = pendingBundlePaymentPath();
      if (!refreshedUser?.id) {
        navigate("/login", { replace: true, state: { from: destination } });
        return;
      }
      if (refreshedUser.id !== user.id) {
        throw new Error("Your account changed while setup was being saved. Sign in again and retry.");
      }
      if (import.meta.env.DEV) {
        console.debug("[prelude-checkout] parent step complete", {
          authenticated: Boolean(refreshedUser?.id),
          userId: refreshedUser?.id || null,
          bundleId: peekPendingBundleIntent()?.bundleId || null,
          destination
        });
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Could not finish this step. Please try again.");
      finishingRef.current = false;
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
      continueDisabled={!canContinue}
      continueLoading={loading}
      continueHint={!canContinue ? "Choose Skip for now to continue. Parent invitations are coming soon." : ""}
      useStepCompletionGate={false}
      onContinue={() => {
        if (stepAlreadyComplete) {
          navigate(pendingBundlePaymentPath());
          return;
        }
        finish();
      }}
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

          {stepAlreadyComplete ? (
            <div className="dash-parent-invite-card__success">
              <p><strong>Parent invite step complete.</strong></p>
              <p className="dash-muted">Continue to choose your Prelude plan, or go back to review your mentor match.</p>
            </div>
          ) : skipped ? (
            <div className="dash-parent-invite-card__success">
              <p><strong>Skipped for now.</strong></p>
              <p className="dash-muted">You can invite a parent later from Settings. Click Next to choose your plan.</p>
            </div>
          ) : (
            <div className="dash-parent-invite-form">
              <label className="prelude-field">
                <span>Parent or guardian email</span>
                <div className="dash-parent-invite-form__input-wrap">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="parent@example.com"
                    autoComplete="email"
                  />
                </div>
              </label>
              {error ? <p className="onboarding-flow__error" role="alert">{error}</p> : null}
              <div className="dash-parent-invite-form__actions">
                <button type="button" className="pm-btn pm-btn--primary" disabled aria-disabled="true">
                  Coming soon!
                </button>
                <button
                  type="button"
                  className="pm-btn pm-btn--ghost"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setSkipped(true);
                  }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </OnboardingShell>
  );
}
