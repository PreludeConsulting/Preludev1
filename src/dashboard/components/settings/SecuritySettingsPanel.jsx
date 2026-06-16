import { useState } from "react";
import { Check, ChevronRight, Lock } from "lucide-react";
import { requestPasswordReset } from "../../../lib/auth.js";
import { DeleteAccountSection } from "../DeleteAccountSection.jsx";
import { SectionCard, SecondaryButton } from "../ui/index.jsx";

export default function SecuritySettingsPanel({ user, onOpenAccount }) {
  const [resetState, setResetState] = useState("idle");

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetState("sending");
    try {
      await requestPasswordReset(user.email);
      setResetState("sent");
    } catch {
      setResetState("error");
    }
  }

  return (
    <>
      <SectionCard title="Password &amp; login" className="dash-panel">
        <div className="dash-setting-row">
          <div className="dash-setting-row__text">
            <span className="dash-setting-row__label">
              <Lock className="h-4 w-4" aria-hidden="true" /> Password
            </span>
            <p className="dash-setting-row__desc">We&apos;ll email a secure link to reset your password.</p>
          </div>
          <SecondaryButton
            type="button"
            className="dash-btn--sm"
            onClick={handlePasswordReset}
            disabled={resetState === "sending"}
          >
            {resetState === "sending" ? "Sending…" : "Send reset link"}
          </SecondaryButton>
        </div>
        {resetState === "sent" ? (
          <span className="dash-save-state dash-save-state--ok">
            <Check className="h-4 w-4" aria-hidden="true" /> Reset link sent to {user?.email}
          </span>
        ) : null}
        {resetState === "error" ? (
          <span className="dash-save-state dash-save-state--err">Couldn&apos;t send a reset link. Please try again.</span>
        ) : null}
      </SectionCard>

      {onOpenAccount ? (
        <SectionCard title="Privacy &amp; data" className="dash-panel">
          <p className="dash-muted">
            Manage your subscription, billing, and what Prelude stores about your account.
          </p>
          <button type="button" className="dash-setting-link" onClick={onOpenAccount}>
            <span>
              <span className="dash-setting-link__label">Manage account &amp; plan</span>
              <span className="dash-setting-link__desc">Subscription, billing, and account options.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </SectionCard>
      ) : null}

      <DeleteAccountSection user={user} />
    </>
  );
}
