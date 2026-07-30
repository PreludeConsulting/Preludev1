import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingBundleIntent,
  peekPendingBundleIntent,
  savePendingBundleIntent
} from "../src/lib/bundlePurchaseIntent.js";

describe("bundle purchase intent", () => {
  beforeEach(() => {
    const createStorage = () => {
      const values = new Map();
      return {
        clear: () => values.clear(),
        getItem: (key) => values.get(key) ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, String(value))
      };
    };
    globalThis.window = {
      localStorage: createStorage(),
      sessionStorage: createStorage()
    };
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("survives page and browser-session restoration until checkout starts", () => {
    savePendingBundleIntent("essay_support");

    expect(peekPendingBundleIntent()).toMatchObject({
      bundleId: "essay_support",
      mode: "bundles"
    });
    expect(window.localStorage.getItem("prelude_pending_bundle_intent")).toContain("essay_support");
  });

  it("clears both durable and legacy session-scoped intent", () => {
    savePendingBundleIntent("essay_support");
    window.sessionStorage.setItem(
      "prelude_pending_bundle_intent",
      JSON.stringify({ bundleId: "essay_support", mode: "bundles" })
    );

    clearPendingBundleIntent();

    expect(peekPendingBundleIntent()).toBeNull();
  });
});
