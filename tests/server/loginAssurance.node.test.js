import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOGIN_ASSURANCE_COOKIE,
  createSessionReference,
  requireLoginAssurance
} from "../../server/lib/loginAssurance.js";

function assuranceAdmin(row) {
  return {
    from() {
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        is() { return builder; },
        gt() { return builder; },
        maybeSingle() { return Promise.resolve({ data: row, error: null }); }
      };
      return builder;
    }
  };
}

describe("server-enforced login assurance", () => {
  const env = { NODE_ENV: "production", LOGIN_CODE_SECRET: "test-secret" };

  it("rejects a protected production request without an assurance cookie", async () => {
    await assert.rejects(
      () => requireLoginAssurance({
        req: { headers: { authorization: "Bearer token" } },
        userId: "user-1",
        admin: assuranceAdmin(null),
        env
      }),
      (error) => error?.statusCode === 403 && error?.code === "login_verification_required"
    );
  });

  it("accepts a live assurance bound to the current bearer session", async () => {
    const authorization = "Bearer session-token";
    const result = await requireLoginAssurance({
      req: {
        headers: {
          authorization,
          cookie: `${LOGIN_ASSURANCE_COOKIE}=raw-assurance-token`
        }
      },
      userId: "user-1",
      admin: assuranceAdmin({ id: "assurance-1", session_reference: createSessionReference(authorization) }),
      env
    });
    assert.equal(result.verified, true);
    assert.equal(result.method, "assurance");
  });

  it("does not require the second-step assurance outside production", async () => {
    const result = await requireLoginAssurance({
      req: { headers: {} },
      userId: "user-1",
      admin: null,
      env: { NODE_ENV: "test" }
    });
    assert.equal(result.verified, true);
    assert.equal(result.method, "not_required");
  });
});
