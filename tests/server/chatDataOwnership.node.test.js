import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createChatApiMiddleware } from "../../server/chatApi.js";

function request(body, headers = {}) {
  const payload = JSON.stringify(body);
  return {
    method: "POST",
    url: "/api/chat",
    headers: { "content-type": "application/json", ...headers },
    on(event, callback) {
      if (event === "data") callback(payload);
      if (event === "end") callback();
      return this;
    }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    end(value) {
      this.body = value ? JSON.parse(value) : null;
    }
  };
}

describe("/api/chat profile ownership", () => {
  const enabledEnv = { PRELUDE_AI_ENABLED: "1" };

  it("does not use client profile data when an authenticated request cannot be verified", async () => {
    let profileSeen = "not-called";
    const authError = Object.assign(new Error("Authentication required."), { statusCode: 401 });
    const middleware = createChatApiMiddleware(
      enabledEnv,
      {
        requireAuthFn: async () => {
          throw authError;
        },
        createRagChatCompletionFn: async (_request, _config, profile) => {
          profileSeen = profile;
          return { answer: "ok", text: "ok", provider: "test", model: "stub", sources: [], actions: [] };
        }
      }
    );

    const res = response();
    await middleware(
      request(
        {
          message: "What should I do next?",
          profile: { name: "Other Student", gpa: "1.0", targetMajors: ["Private major"] }
        },
        { authorization: "Bearer invalid-or-foreign-token" }
      ),
      res,
      () => assert.fail("chat route should be handled")
    );

    assert.equal(res.statusCode, 200);
    assert.equal(profileSeen, null);
  });

  it("uses authenticated server-owned profile facts instead of client overrides", async () => {
    let profileSeen = null;
    const middleware = createChatApiMiddleware(
      enabledEnv,
      {
        requireAuthFn: async () => ({
          user: {
            id: "user-1",
            firstName: "Jordan",
            lastName: "Student",
            role: "STUDENT",
            plan: "PLUS"
          }
        }),
        dbFactory: () => ({
          studentProfile: {
            findUnique: async ({ where }) => {
              assert.equal(where.userId, "user-1");
              return {
                graduationYear: 2027,
                highSchool: "Prelude High",
                location: "Atlanta, GA",
                targetMajors: ["Computer Science"],
                gpa: "3.8",
                testScores: { sat: "1420" },
                preferences: { budget: "Need merit aid" },
                progress: {}
              };
            }
          }
        }),
        createRagChatCompletionFn: async (_request, _config, profile) => {
          profileSeen = profile;
          return { answer: "ok", text: "ok", provider: "test", model: "stub", sources: [], actions: [] };
        }
      }
    );

    const res = response();
    await middleware(
      request(
        {
          message: "What should I do next?",
          profile: { name: "Other Student", gpa: "1.0", targetMajors: ["Private major"] }
        },
        { cookie: "prelude_access=test" }
      ),
      res,
      () => assert.fail("chat route should be handled")
    );

    assert.equal(res.statusCode, 200);
    assert.equal(profileSeen.name, "Jordan Student");
    assert.equal(profileSeen.gpa, "3.8");
    assert.deepEqual(profileSeen.targetMajors, ["Computer Science"]);
  });
});
