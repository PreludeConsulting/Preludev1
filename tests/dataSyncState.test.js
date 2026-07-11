import { describe, expect, it } from "vitest";
import { createSyncState, SYNC_STATUS, syncStateLabel } from "../src/dashboard/lib/dataSyncState.js";

describe("dataSyncState", () => {
  it("creates idle sync state by default", () => {
    expect(createSyncState()).toMatchObject({
      status: SYNC_STATUS.IDLE,
      error: null,
      source: "server"
    });
  });

  it("labels failed sync with error message", () => {
    expect(syncStateLabel(createSyncState({
      status: SYNC_STATUS.FAILED,
      error: "Dashboard sync failed."
    }))).toBe("Dashboard sync failed.");
  });
});
