import { useState } from "react";
import { cn } from "../../lib/utils.js";

export default function IntegrationConnect({
  label,
  connected,
  connectLabel,
  onConnect,
  onDisconnect,
  description
}) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      await onConnect?.();
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await onDisconnect?.();
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
        <button type="button" className="dash-btn-secondary" onClick={handleDisconnect} disabled={loading}>
          Disconnect
        </button>
      ) : (
        <button type="button" className="dash-btn-primary" onClick={handleConnect} disabled={loading}>
          {connectLabel || `Connect ${label}`}
        </button>
      )}
    </div>
  );
}
