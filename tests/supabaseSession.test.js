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
  it("treats a confirmed auth user as verified when the public profile email is null", () => {
    const user = mapSupabaseUser(
      session({
        email: "vincent.zhu@preludeconsultingllc.com",
        email_confirmed_at: null,
        confirmed_at: "2026-07-31T01:00:00.000Z"
      }),
      {
        id: "user-1",
        email: null,
        full_name: "Vincent Zhu",
        role: "student",
        role_selection_complete: true
      },
      {
        mentor_matching_complete: false,
        parent_invite_step_completed: false,
        onboarding_status: "needs_match"
      }
    );

    expect(user.email).toBe("vincent.zhu@preludeconsultingllc.com");
    expect(user.emailVerified).toBe(true);
    expect(user.matchOnboardingComplete).toBe(false);
    expect(user.firstName).toBe("Vincent");
    expect(user.preferredName).toBe("");
  });

  it("prefers preferred_name for dashboard first-name display", () => {
    const user = mapSupabaseUser(
      session({
        email: "ada@example.com",
        email_confirmed_at: "2026-08-01T00:00:00.000Z"
      }),
      {
        id: "user-1",
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        preferred_name: "Ada",
        role: "student",
        role_selection_complete: true
      },
      {
        mentor_matching_complete: true,
        questionnaire_answers: { studentName: { firstName: "Ada", lastName: "Lovelace" } }
      }
    );

    expect(user.preferredName).toBe("Ada");
    expect(user.firstName).toBe("Ada");
    expect(user.name).toBe("Ada Lovelace");
  });

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

  it("keeps promo users on match onboarding when payment is waived early", () => {
    const user = mapSupabaseUser(
      session(),
      {
        id: "user-1",
        full_name: "Promo Student",
        role: "student",
        role_selection_complete: true,
        plan_id: "basic",
        payment_waived: true,
        subscription_status: "promotional"
      },
      {
        mentor_matching_complete: false,
        parent_invite_step_completed: false,
        payment_step_completed: true,
        onboarding_status: "onboarding_completed"
      }
    );

    expect(user.matchOnboardingComplete).toBe(false);
    expect(user.paymentStepComplete).toBe(true);
    expect(user.onboardingStatus).toBe("needs_match");
  });

  it("uses the stored profile avatar before OAuth metadata", () => {
    const user = mapSupabaseUser(
      session({
        user_metadata: {
          picture: "https://accounts.google.com/photo.jpg"
        }
      }),
      {
        id: "user-1",
        full_name: "Solomon Cho",
        role: "student",
        role_selection_complete: true,
        avatar_url: "https://cdn.prelude.com/profile.jpg"
      }
    );

    expect(user.avatarUrl).toBe("https://cdn.prelude.com/profile.jpg");
  });

  it("keeps a Google profile photo when no stored profile avatar exists", () => {
    const user = mapSupabaseUser(
      session({
        user_metadata: {
          picture: "https://accounts.google.com/photo.jpg"
        }
      }),
      {
        id: "user-1",
        full_name: "Solomon Cho",
        role: "student",
        role_selection_complete: true,
        avatar_url: null
      }
    );

    expect(user.avatarUrl).toBe("https://accounts.google.com/photo.jpg");
  });

  it("preserves a mentor role while adding Matching Team access from the server", () => {
    const user = mapSupabaseUser(
      session({
        user_metadata: {
          role: "mentor"
        }
      }),
      {
        id: "user-1",
        full_name: "Alex Huang",
        role: "mentor",
        role_selection_complete: true,
        avatar_url: null
      },
      null,
      false,
      { completed: true },
      { matchingTeamAccess: true }
    );

    expect(user.role).toBe("mentor");
    expect(user.systemRole).toBe("mentor");
    expect(user.matchingTeamAccess).toBe(true);
    expect(user.isMatchingTeam).toBe(true);
  });
});
