import { describe, expect, it } from "vitest";
import { friendlyVerificationError } from "../src/components/AuthPages.jsx";

describe("login verification error messages", () => {
  it.each([
    ["incorrect_code", "That code is not correct. Check the email and try again."],
    ["expired_code", "That code expired. Request a new one to continue."],
    ["used_code", "That code has already been used. Request a new one."],
    ["rate_limited", "Too many codes requested. Please wait and try again."],
    ["server_error", "Prelude could not verify the code right now. Please try again."],
  ])("maps %s without exposing raw errors", (code, expected) => {
    expect(friendlyVerificationError({ payload: { error: code }, message: "Cannot read properties of null (reading 'next')" })).toBe(expected);
  });

  it("distinguishes network failures from invalid codes", () => {
    expect(friendlyVerificationError(new TypeError("Failed to fetch"))).toBe(
      "We could not reach Prelude. Check your connection and try again."
    );
  });

  it("hides unexpected JavaScript exception details", () => {
    expect(friendlyVerificationError(new TypeError("Cannot read properties of null (reading 'next')"))).toBe(
      "Verification could not be completed. Please try again."
    );
  });
});
