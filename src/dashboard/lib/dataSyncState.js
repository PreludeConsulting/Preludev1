/** @typedef {'idle' | 'loading' | 'saved' | 'unsaved' | 'failed'} SyncStatus */

export const SYNC_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  SAVED: "saved",
  UNSAVED: "unsaved",
  FAILED: "failed"
};

/**
 * @param {Partial<{ status: SyncStatus, error: string | null, lastSyncedAt: string | null, source: string }>} fields
 */
export function createSyncState(fields = {}) {
  return {
    status: fields.status ?? SYNC_STATUS.IDLE,
    error: fields.error ?? null,
    lastSyncedAt: fields.lastSyncedAt ?? null,
    source: fields.source ?? "server"
  };
}

export function syncStateLabel(state) {
  switch (state?.status) {
    case SYNC_STATUS.LOADING:
      return "Syncing…";
    case SYNC_STATUS.SAVED:
      return state.lastSyncedAt ? `Saved ${formatSyncTime(state.lastSyncedAt)}` : "Saved";
    case SYNC_STATUS.UNSAVED:
      return "Unsaved changes";
    case SYNC_STATUS.FAILED:
      return state.error || "Sync failed";
    default:
      return "";
  }
}

function formatSyncTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function isSyncBlocking(state) {
  return state?.status === SYNC_STATUS.LOADING;
}

export function hasSyncFailure(state) {
  return state?.status === SYNC_STATUS.FAILED;
}
