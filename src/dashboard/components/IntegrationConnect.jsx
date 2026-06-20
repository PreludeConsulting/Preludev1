import { useState } from "react";
import { cn } from "../../lib/utils.js";
import { PrimaryButton, SecondaryButton } from "./ui/index.jsx";

export default function IntegrationConnect({
  label,
  connected,
  connectLabel,
  onConnect,
  onDisconnect,
  description
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setLoading(true);
    setError("");
    try {
      await onConnect?.();
    } catch (err) {
      setError(err?.message || `Could not connect ${label}. Try again.`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    setError("");
    try {
      await onDisconnect?.();
    } catch (err) {
      setError(err?.message || `Could not disconnect ${label}. Try again.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-integration paper-card">
      <div className="dash-integration__head">
        <div>
          <p className="dash-integration__label">{label}</p>
          {description ? <p className="dash-integration__desc">{description}</p> : null}
        </div>
        <span className={cn("dash-integration__status", connected && "dash-integration__status--on")}>
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      {connected ? (
        <SecondaryButton type="button" onClick={handleDisconnect} disabled={loading}>
          {loading ? "Disconnecting…" : "Disconnect"}
        </SecondaryButton>
      ) : (
        <PrimaryButton type="button" onClick={handleConnect} disabled={loading}>
          {loading ? "Connecting…" : connectLabel || `Connect ${label}`}
        </PrimaryButton>
      )}
      {error ? <p className="dash-integration__error" role="alert">{error}</p> : null}
    </div>
  );
}
