import { describe, expect, it } from "vitest";
import {
  getPasswordRequirementStatus,
  maskEmail,
  passwordsMatch,
  validatePasswordForAuth
} from "../shared/passwordValidation.js";

describe("password validation", () => {
  it("masks email addresses for reset copy", () => {
    expect(maskEmail("alex.student@school.edu")).toBe("a••••••••@school.edu");
  });

  it("requires stronger passwords for reset than signup", () => {
    expect(validatePasswordForAuth("short1", true, "signup")).toBe("");
    expect(validatePasswordForAuth("short1", true, "reset")).toMatch(/requirements/i);
    expect(validatePasswordForAuth("StrongPass1", true, "reset")).toBe("");
  });

  it("tracks password match state", () => {
    expect(passwordsMatch("StrongPass1", "StrongPass1")).toBe(true);
    expect(passwordsMatch("StrongPass1", "StrongPass2")).toBe(false);
  });

  it("reports legacy password requirements", () => {
    const requirements = getPasswordRequirementStatus("Aa1!abcdefghij", false, "signup");
    expect(requirements.every((rule) => rule.met)).toBe(true);
  });
});
