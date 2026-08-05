import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EMPTY_MENTOR_PROFILE_FORM,
  mentorProfileFormFromData,
  normalizeMentorProfilePayload,
  validateMentorProfileForm
} from "../src/dashboard/components/mentor/mentorProfileFormShared.jsx";
import { extractMentorFields } from "../src/lib/mentorQuestionnaireService.js";
import { mapMentorMatchingProfile } from "../shared/mentorMatching.js";

const COMPLETE_FORM = {
  ...EMPTY_MENTOR_PROFILE_FORM,
  fullName: "Ada Mentor",
  avatarUrl: "https://example.com/ada.webp",
  college: "Brown University",
  major: "Computer Science",
  bio: "I help students tell a clear story.",
  specialties: ["Essay editing", "Choosing colleges"],
  targetMajors: ["Computer science"],
  supportStyles: ["Direct tactical feedback"],
  applicationStrengths: ["Competitive admissions"],
  availability: "Weeknights"
};

describe("shared mentor profile identity", () => {
  it("loads full name and photo from the matching profile", () => {
    const form = mentorProfileFormFromData(null, {
      display_name: "Ada Mentor",
      avatar_url: "https://example.com/ada.webp",
      college: "Brown University"
    });
    expect(form.fullName).toBe("Ada Mentor");
    expect(form.avatarUrl).toBe("https://example.com/ada.webp");
  });

  it("requires both a full name and profile photo", () => {
    expect(validateMentorProfileForm({ ...COMPLETE_FORM, fullName: "" }).fullName).toBeTruthy();
    expect(validateMentorProfileForm({ ...COMPLETE_FORM, avatarUrl: "" }).avatarUrl).toBeTruthy();
    expect(validateMentorProfileForm(COMPLETE_FORM)).toEqual({});
  });

  it("normalizes identity fields with the rest of the shared form", () => {
    const payload = normalizeMentorProfilePayload({
      ...COMPLETE_FORM,
      fullName: "  Ada Mentor  ",
      avatarUrl: "  https://example.com/ada.webp  "
    });
    expect(payload.fullName).toBe("Ada Mentor");
    expect(payload.avatarUrl).toBe("https://example.com/ada.webp");
  });

  it("extracts directory identity from saved questionnaire answers", () => {
    const fields = extractMentorFields(COMPLETE_FORM);
    expect(fields.fullName).toBe("Ada Mentor");
    expect(fields.avatarUrl).toBe("https://example.com/ada.webp");
  });
});

describe("mentor network card mapping", () => {
  it("maps the saved name, photo, major, and help options", () => {
    const mentor = mapMentorMatchingProfile({
      mentor_user_id: "mentor-1",
      display_name: "Ada Mentor",
      avatar_url: "https://example.com/ada.webp",
      college: "Brown University",
      major: "Computer Science",
      specialties: ["Essay editing"],
      completed: true
    });
    expect(mentor).toMatchObject({
      id: "mentor-1",
      name: "Ada Mentor",
      avatarUrl: "https://example.com/ada.webp",
      photo: "https://example.com/ada.webp",
      major: "Computer Science",
      specialties: ["Essay editing"]
    });
  });
});

describe("mentor network migration", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260805200000_mentor_network_profiles.sql", import.meta.url),
    "utf8"
  );

  it("adds the public avatar field and the hardened column grants", () => {
    expect(sql).toContain("add column if not exists avatar_url text");
    expect(sql).toMatch(/grant insert \(avatar_url\), update \(avatar_url\)/i);
  });

  it("keeps private profiles out of the student data path", () => {
    expect(sql).not.toMatch(/create\s+(or replace\s+)?view/i);
    expect(sql).not.toMatch(/security\s+definer/i);
  });

  it("enables realtime without adding the table twice", () => {
    expect(sql).toContain("pg_publication_tables");
    expect(sql).toContain("alter publication supabase_realtime add table public.mentor_matching_profiles");
  });
});
