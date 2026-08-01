// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataSyncBanner from "../src/dashboard/components/DataSyncBanner.jsx";
import { SYNC_STATUS, createSyncState } from "../src/dashboard/lib/dataSyncState.js";

const root_ = process.cwd();
const readSource = (file) => fs.readFileSync(path.join(root_, file), "utf8");

let host;
let root;

describe("DataSyncBanner accessibility surface", () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
    root = null;
    host = null;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it("renders nothing for idle or null sync state (valid empty results show no error)", () => {
    act(() => root.render(<DataSyncBanner syncState={null} />));
    expect(host.querySelector(".dash-sync-banner")).toBeNull();

    act(() => root.render(<DataSyncBanner syncState={createSyncState({ status: SYNC_STATUS.IDLE })} />));
    expect(host.querySelector(".dash-sync-banner")).toBeNull();
  });

  it("renders exactly one assertive alert with a Retry action when sync failed", () => {
    const onRetry = vi.fn();
    act(() => {
      root.render(
        <DataSyncBanner
          syncState={createSyncState({ status: SYNC_STATUS.FAILED, error: "Dashboard data is temporarily unavailable." })}
          onRetry={onRetry}
        />
      );
    });

    const banners = host.querySelectorAll(".dash-sync-banner");
    expect(banners.length).toBe(1);
    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.getAttribute("aria-live")).toBe("assertive");
    expect(alert.textContent).toContain("Dashboard data is temporarily unavailable.");

    const retryButton = host.querySelector("button");
    expect(retryButton).not.toBeNull();
    retryButton.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a Retry action for non-failed states", () => {
    act(() => {
      root.render(<DataSyncBanner syncState={createSyncState({ status: SYNC_STATUS.LOADING })} onRetry={vi.fn()} />);
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector("button")).toBeNull();
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });
});

describe("DashboardLayout error surface consolidation", () => {
  it("renders exactly one DataSyncBanner and no duplicate dash-callout error banner", () => {
    const source = readSource("src/dashboard/components/DashboardLayout.jsx");
    const bannerUsages = source.match(/<DataSyncBanner\b/g) || [];
    expect(bannerUsages.length).toBe(1);
    expect(source).not.toMatch(/dash-callout[^"']*["'][^>]*>\s*\{?\s*dataError/);
    expect(source).toContain("onRetry={refresh}");
  });
});
