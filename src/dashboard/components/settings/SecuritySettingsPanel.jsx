import { useEffect, useState } from "react";
import { Check, ChevronRight, Laptop, Lock, Trash2 } from "lucide-react";
import { requestPasswordReset } from "../../../lib/auth.js";
import { isSupabaseConfigured } from "../../../lib/supabaseConfig.js";
import { listTrustedDevices, revokeOtherTrustedDevices, revokeTrustedDevice } from "../../../lib/loginVerification.js";
import { getTrustedDeviceSections } from "../../lib/trustedDevices.js";
import { DeleteAccountSection } from "../DeleteAccountSection.jsx";
import { SectionCard, SecondaryButton } from "../ui/index.jsx";

export default function SecuritySettingsPanel({ user, onOpenAccount }) {
  const [resetState, setResetState] = useState("idle");
  const [devices, setDevices] = useState([]);
  const [devicesState, setDevicesState] = useState("idle");
  const [devicesError, setDevicesError] = useState("");
  const [devicesMessage, setDevicesMessage] = useState("");
  const deviceSections = getTrustedDeviceSections(devices);

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
    setDevicesMessage("");
    try {
      await revokeTrustedDevice(id);
      setDevices((current) => current.filter((device) => device.id !== id));
      setDevicesMessage("Trusted device revoked.");
    } catch (error) {
      setDevicesError(error.message || "Could not revoke that trusted device.");
    }
  }

  async function revokeOthers() {
    setDevicesError("");
    setDevicesMessage("");
    try {
      await revokeOtherTrustedDevices();
      await loadDevices();
      setDevicesMessage("Other trusted devices revoked.");
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
          {devicesMessage ? <span className="dash-save-state dash-save-state--ok" role="status"><Check className="h-4 w-4" aria-hidden="true" /> {devicesMessage}</span> : null}
          {devicesState === "loading" ? <p className="dash-muted">Loading trusted devices…</p> : null}
          <div className="dash-trusted-devices">
            {deviceSections.active.map((device) => (
              <div key={device.id} className="dash-setting-row dash-trusted-device">
                <div className="dash-setting-row__text">
                  <span className="dash-setting-row__label">
                    <Laptop className="h-4 w-4" aria-hidden="true" /> {device.device_name || device.user_agent_summary || "Trusted device"}
                    {device.current ? <span className="dash-badge dash-badge--soft">Current device</span> : null}
                  </span>
                  <p className="dash-setting-row__desc">
                    Browser / OS: {device.browserOs} · Last used {device.lastUsedLabel} · Expires {device.expiresLabel}
                  </p>
                </div>
                <SecondaryButton type="button" className="dash-btn--sm" onClick={() => revokeDevice(device.id)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Revoke
                </SecondaryButton>
              </div>
            ))}
            {!deviceSections.active.length && devicesState !== "loading" ? (
              <p className="dash-muted dash-empty-inline">No trusted devices yet.</p>
            ) : null}
          </div>
          {deviceSections.revoked.length ? (
            <details className="dash-revoked-devices">
              <summary>Recently revoked</summary>
              <ul>
                {deviceSections.revoked.slice(0, 3).map((device) => (
                  <li key={device.id}>{device.label} · Revoked {device.revokedLabel}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="mt-4">
            <SecondaryButton type="button" className="dash-btn--sm" onClick={revokeOthers} disabled={deviceSections.active.length <= 1}>
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
