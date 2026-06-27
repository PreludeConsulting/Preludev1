import { describe, expect, it } from "vitest";
import { mapSupabaseUser } from "../src/lib/supabaseSession.js";

function session(overrides = {}) {
  return {
    user: {
      id: "user-1",
      email: "new@example.com",
      user_metadata: {},
      identities: [],
      ...overrides
    }
  };
}

describe("mapSupabaseUser", () => {
  it("does not send first-login users to plan selection before role selection", () => {
    const user = mapSupabaseUser(
      session(),
      {
        id: "user-1",
        full_name: "New User",
        role: "student",
        role_selection_complete: false,
        plan_id: null
      },
      { onboarding_status: "needs_plan" }
    );

    expect(user.role).toBe("student");
    expect(user.roleSelectionComplete).toBe(false);
    expect(user.onboardingStatus).toBeNull();
    expect(user.planSelected).toBe(false);
  });
});
