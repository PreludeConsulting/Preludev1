import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertDurableStoreAvailable, canUseLocalJsonStore } from "../../server/lib/durableStorePolicy.js";

describe("durable production store policy", () => {
  it("allows the JSON fixture store only outside production", () => {
    assert.equal(canUseLocalJsonStore({ NODE_ENV: "development" }), true);
    assert.equal(canUseLocalJsonStore({ NODE_ENV: "test" }), true);
    assert.equal(canUseLocalJsonStore({ NODE_ENV: "production" }), false);
  });

  it("fails closed when production cannot reach its database", () => {
    assert.throws(
      () => assertDurableStoreAvailable({ NODE_ENV: "production" }, "meeting"),
      (error) => error?.statusCode === 503 && error?.code === "durable_store_unavailable"
    );
  });
});
