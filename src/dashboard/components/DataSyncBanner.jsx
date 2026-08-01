import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";
import { SYNC_STATUS, syncStateLabel } from "../lib/dataSyncState.js";

export default function DataSyncBanner({ syncState, className = "", onRetry = null }) {
  if (!syncState || syncState.status === SYNC_STATUS.IDLE) return null;

  const label = syncStateLabel(syncState);
  if (!label) return null;

  const failed = syncState.status === SYNC_STATUS.FAILED;
  const Icon =
    syncState.status === SYNC_STATUS.LOADING
      ? Loader2
      : syncState.status === SYNC_STATUS.SAVED
        ? Check
        : failed
          ? CloudOff
          : AlertTriangle;

  const modifier =
    syncState.status === SYNC_STATUS.SAVED
      ? "saved"
      : failed
        ? "failed"
        : syncState.status === SYNC_STATUS.UNSAVED
          ? "unsaved"
          : "loading";

  return (
    <div
      className={`dash-sync-banner dash-sync-banner--${modifier} ${className}`.trim()}
      role={failed ? "alert" : "status"}
      aria-live={failed ? "assertive" : "polite"}
    >
      <Icon className={`dash-sync-banner__icon${syncState.status === SYNC_STATUS.LOADING ? " dash-sync-banner__icon--spin" : ""}`} aria-hidden="true" />
      <span>{label}</span>
      {failed && typeof onRetry === "function" ? (
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
