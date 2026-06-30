import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOGIN_VERIFICATION_STORAGE_ERROR,
  LOGIN_VERIFICATION_STORAGE_MESSAGE,
  isLoginVerificationStorageError
} from "../../server/supabaseLoginVerificationApi.js";

describe("login verification diagnostics", () => {
  it("classifies missing Supabase verification tables as setup errors", () => {
    assert.equal(
      isLoginVerificationStorageError({
        code: "PGRST205",
        message: "Could not find the table 'public.login_verification_challenges' in the schema cache"
      }),
      true
    );
    assert.equal(
      isLoginVerificationStorageError({
        message: "Could not find the table 'public.trusted_devices' in the schema cache"
      }),
      true
    );
    assert.equal(
      isLoginVerificationStorageError({
        message: "Could not find the table 'public.login_assurances' in the schema cache"
      }),
      true
    );
  });

  it("does not classify unrelated Supabase failures as setup errors", () => {
    assert.equal(isLoginVerificationStorageError({ code: "23505", message: "duplicate key value violates unique constraint" }), false);
    assert.equal(isLoginVerificationStorageError({ message: "JWT expired" }), false);
    assert.equal(isLoginVerificationStorageError(null), false);
  });

  it("documents the public error contract for the UI", () => {
    assert.equal(LOGIN_VERIFICATION_STORAGE_ERROR, "login_verification_storage_missing");
    assert.match(LOGIN_VERIFICATION_STORAGE_MESSAGE, /supabase\/migrations\/20260629000000_login_verification_trusted_devices\.sql/i);
  });
});
