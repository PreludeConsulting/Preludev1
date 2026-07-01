import { useEffect, useState } from "react";
import { Check, ChevronRight, Laptop, Lock, Trash2 } from "lucide-react";
import { requestPasswordReset } from "../../../lib/auth.js";
import { isSupabaseConfigured } from "../../../lib/supabaseConfig.js";
import { listTrustedDevices, revokeOtherTrustedDevices, revokeTrustedDevice } from "../../../lib/loginVerification.js";
import { DeleteAccountSection } from "../DeleteAccountSection.jsx";
import { SectionCard, SecondaryButton } from "../ui/index.jsx";

export default function SecuritySettingsPanel({ user, onOpenAccount }) {
  const [resetState, setResetState] = useState("idle");
  const [devices, setDevices] = useState([]);
  const [devicesState, setDevicesState] = useState("idle");
  const [devicesError, setDevicesError] = useState("");

  async function loadDevices() {
    if (!isSupabaseConfigured()) return;
    setDevicesState("loading");
    setDevicesError("");
    try {
      const result = await listTrustedDevices();
      setDevices(result.devices || []);
      setDevicesState("loaded");
    } catch (error) {
      setDevicesError(error.message || "Could not load trusted devices.");
      setDevicesState("error");
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetState("sending");
    try {
      if (isSupabaseConfigured()) {
        const { resetPassword: requestSupabasePasswordReset } = await import("../../../lib/supabaseAuth.js");
        const { error } = await requestSupabasePasswordReset(user.email, "", { skipCaptcha: true });
        if (error) throw new Error(error);
      } else {
        await requestPasswordReset(user.email);
      }
      setResetState("sent");
    } catch {
      setResetState("error");
    }
  }

  async function revokeDevice(id) {
    setDevicesError("");
    try {
      await revokeTrustedDevice(id);
      await loadDevices();
    } catch (error) {
      setDevicesError(error.message || "Could not revoke that trusted device.");
    }
  }

  async function revokeOthers() {
    setDevicesError("");
    try {
      await revokeOtherTrustedDevices();
      await loadDevices();
    } catch (error) {
      setDevicesError(error.message || "Could not revoke trusted devices.");
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

      {isSupabaseConfigured() ? (
        <SectionCard title="Trusted devices" className="dash-panel">
          <p className="dash-muted">Devices you trusted after login can skip verification codes until they expire or are revoked.</p>
          {devicesError ? <span className="dash-save-state dash-save-state--err">{devicesError}</span> : null}
          {devicesState === "loading" ? <p className="dash-muted">Loading trusted devices…</p> : null}
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.id} className="dash-setting-row">
                <div className="dash-setting-row__text">
                  <span className="dash-setting-row__label">
                    <Laptop className="h-4 w-4" aria-hidden="true" /> {device.device_name || device.user_agent_summary || "Trusted device"}
                  </span>
                  <p className="dash-setting-row__desc">
                    Trusted {new Date(device.created_at).toLocaleDateString()} · Last used {device.last_used_at ? new Date(device.last_used_at).toLocaleDateString() : "not yet"} · Expires {new Date(device.expires_at).toLocaleDateString()}
                    {device.revoked_at ? " · Revoked" : ""}
                  </p>
                </div>
                {!device.revoked_at ? (
                  <SecondaryButton type="button" className="dash-btn--sm" onClick={() => revokeDevice(device.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Revoke
                  </SecondaryButton>
                ) : null}
              </div>
            ))}
            {!devices.length && devicesState !== "loading" ? <p className="dash-muted">No trusted devices yet.</p> : null}
          </div>
          <div className="mt-4">
            <SecondaryButton type="button" className="dash-btn--sm" onClick={revokeOthers}>
              Revoke all other devices
            </SecondaryButton>
          </div>
        </SectionCard>
      ) : null}

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
