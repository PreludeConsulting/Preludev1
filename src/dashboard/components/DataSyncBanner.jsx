import { AlertTriangle, Check, CloudOff, Loader2 } from "lucide-react";
import { SYNC_STATUS, syncStateLabel } from "../lib/dataSyncState.js";

export default function DataSyncBanner({ syncState, className = "" }) {
  if (!syncState || syncState.status === SYNC_STATUS.IDLE) return null;

  const label = syncStateLabel(syncState);
  if (!label) return null;

  const Icon =
    syncState.status === SYNC_STATUS.LOADING
      ? Loader2
      : syncState.status === SYNC_STATUS.SAVED
        ? Check
        : syncState.status === SYNC_STATUS.FAILED
          ? CloudOff
          : AlertTriangle;

  const modifier =
    syncState.status === SYNC_STATUS.SAVED
      ? "saved"
      : syncState.status === SYNC_STATUS.FAILED
        ? "failed"
        : syncState.status === SYNC_STATUS.UNSAVED
          ? "unsaved"
          : "loading";

  return (
    <div className={`dash-sync-banner dash-sync-banner--${modifier} ${className}`.trim()} role="status" aria-live="polite">
      <Icon className={`dash-sync-banner__icon${syncState.status === SYNC_STATUS.LOADING ? " dash-sync-banner__icon--spin" : ""}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
