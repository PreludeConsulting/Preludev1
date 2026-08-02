import { describe, expect, it } from "vitest";
import { friendlyVerificationError } from "../src/components/AuthPages.jsx";

describe("login verification error messages", () => {
  it.each([
    ["incorrect_code", /invalid or has expired/i],
    ["expired_code", /invalid or has expired/i],
    ["used_code", /invalid or has expired/i],
    ["rate_limited", /too many attempts/i],
    ["server_error", /couldn’t verify your email right now/i],
  ])("maps %s without exposing raw errors", (code, expected) => {
    expect(
      friendlyVerificationError({
        payload: { error: code },
        message: "Cannot read properties of null (reading 'next')"
      })
    ).toMatch(expected);
  });

  it("distinguishes network failures from invalid codes", () => {
    expect(friendlyVerificationError(new TypeError("Failed to fetch"))).toMatch(
      /couldn’t verify your email right now/i
    );
  });

  it("hides unexpected JavaScript exception details", () => {
    expect(
      friendlyVerificationError(new TypeError("Cannot read properties of null (reading 'next')"))
    ).toMatch(/couldn’t verify your email right now/i);
  });
});
