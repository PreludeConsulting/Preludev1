import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { friendlyParentInviteError } from "../shared/parentInviteErrors.js";

describe("friendlyParentInviteError", () => {
  it("maps missing Supabase tables to setup guidance", () => {
    const message = friendlyParentInviteError({
      message: 'relation "public.parent_invites" does not exist'
    });
    assert.match(message, /not enabled in Supabase/i);
  });

  it("maps authentication failures", () => {
    assert.match(
      friendlyParentInviteError({ message: "Authentication required.", payload: { error: "unauthenticated" } }),
      /session expired/i
    );
  });

  it("maps self-invite attempts", () => {
    assert.match(
      friendlyParentInviteError({ code: "invalid_parent_email" }),
      /not your own/i
    );
  });

  it("preserves RPC validation messages", () => {
    assert.equal(
      friendlyParentInviteError({ message: "You can only connect a parent email to your own account." }),
      "Sign in as the student account before inviting a parent."
    );
  });
});
