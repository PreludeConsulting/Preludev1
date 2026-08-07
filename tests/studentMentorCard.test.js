import { describe, expect, it } from "vitest";
import {
  buildMentorCollegeLine,
  enrichAssignedMentorMatch,
  formatMentorCollegeLine,
  pickStableMentorCardTags,
  resolveMentorCardBio,
  resolveMentorCardGraduationYear,
  resolveMentorCardMajor,
  resolveMentorCardPhoto
} from "../src/lib/studentMentorCard.js";
import { SHARED_MENTOR } from "../src/data/demoDashboardData.js";

describe("studentMentorCard colleges", () => {
  it("shows the mentor college first and at most two unique target schools", () => {
    const colleges = buildMentorCollegeLine({
      college: "Georgia Institute of Technology",
      targetSchools: [
        "Emory University",
        "University of Georgia",
        "Duke University",
        "Georgia Institute of Technology"
      ]
    });

    expect(colleges).toEqual([
      "Georgia Institute of Technology",
      "Emory University",
      "University of Georgia"
    ]);
    expect(formatMentorCollegeLine({ college: "Georgia Institute of Technology", targetSchools: colleges.slice(1) }))
      .toContain(" · ");
  });

  it("removes duplicate colleges case-insensitively", () => {
    expect(
      buildMentorCollegeLine({
        university: "Emory University",
        targetSchools: ["emory university", "University of Georgia"]
      })
    ).toEqual(["Emory University", "University of Georgia"]);
  });

  it("shows only the mentor college when target schools are missing", () => {
    expect(buildMentorCollegeLine({ college: "UCLA", targetSchools: [] })).toEqual(["UCLA"]);
  });

  it("omits college line pieces when data is missing", () => {
    expect(buildMentorCollegeLine({})).toEqual([]);
    expect(buildMentorCollegeLine(null)).toEqual([]);
  });
});

describe("studentMentorCard tags", () => {
  it("picks one option from each populated checkbox section", () => {
    const tags = pickStableMentorCardTags({
      id: "mentor-a",
      specialties: ["Application strategy", "Essay editing"],
      targetMajors: ["Computer science", "Engineering"],
      supportStyles: ["Structured step-by-step guidance", "Flexible and conversational"]
    });

    expect(tags).toHaveLength(3);
    expect(["Application strategy", "Essay editing"]).toContain(tags[0]);
    expect(["Computer science", "Engineering"]).toContain(tags[1]);
    expect(["Structured step-by-step guidance", "Flexible and conversational"]).toContain(tags[2]);
  });

  it("never invents unchecked options", () => {
    const tags = pickStableMentorCardTags({
      id: "mentor-b",
      specialties: ["Scholarships"],
      targetMajors: [],
      supportStyles: ["Direct tactical feedback"]
    });

    expect(tags).toEqual(
      expect.arrayContaining(["Scholarships", "Direct tactical feedback"])
    );
    expect(tags).toHaveLength(2);
    expect(tags).not.toContain("Computer science");
    expect(tags).not.toContain("Application strategy");
  });

  it("keeps tags stable across repeated calls for the same mentor", () => {
    const mentor = {
      mentorUserId: "stable-mentor-1",
      specialties: ["Choosing colleges", "Application strategy", "Essay brainstorming"],
      targetMajors: ["Business", "Economics", "Pre-med"],
      supportStyles: ["Flexible and conversational", "Accountability and check-ins", "Big-picture exploration"]
    };

    const first = pickStableMentorCardTags(mentor);
    const second = pickStableMentorCardTags({ ...mentor });
    expect(second).toEqual(first);
  });

  it("uses different mentor IDs independently so one mentor never bleeds into another", () => {
    const mentorA = enrichAssignedMentorMatch(
      { id: "match-1", mentor_name: "A", mentor_id: "mentor-a", student_id: "student-1" },
      {
        mentor_user_id: "mentor-a",
        display_name: "Alex Mentor",
        college: "Stanford",
        major: "History",
        bio: "Alex bio",
        specialties: ["Essay editing"],
        target_majors: ["Humanities"],
        target_schools: ["Yale"],
        support_styles: ["Encouraging and easy to talk to"]
      },
      { id: "mentor-a", avatar_url: "/a.png", graduation_year: 2026 }
    );
    const mentorB = enrichAssignedMentorMatch(
      { id: "match-2", mentor_name: "B", mentor_id: "mentor-b", student_id: "student-2" },
      {
        mentor_user_id: "mentor-b",
        display_name: "Blake Mentor",
        college: "MIT",
        major: "Physics",
        bio: "Blake bio",
        specialties: ["Interview preparation"],
        target_majors: ["Natural sciences"],
        target_schools: ["Caltech"],
        support_styles: ["Direct tactical feedback"]
      },
      { id: "mentor-b", avatar_url: "/b.png", graduation_year: 2025 }
    );

    expect(mentorA.name).toBe("Alex Mentor");
    expect(mentorB.name).toBe("Blake Mentor");
    expect(mentorA.bio).toBe("Alex bio");
    expect(mentorB.bio).toBe("Blake bio");
    expect(buildMentorCollegeLine(mentorA)).toEqual(["Stanford", "Yale"]);
    expect(buildMentorCollegeLine(mentorB)).toEqual(["MIT", "Caltech"]);
    expect(pickStableMentorCardTags(mentorA)).not.toEqual(pickStableMentorCardTags(mentorB));
    expect(resolveMentorCardPhoto(mentorA)).toBe("/a.png");
    expect(resolveMentorCardPhoto(mentorB)).toBe("/b.png");
  });
});

describe("studentMentorCard missing fields", () => {
  it("hides missing major, bio, graduation year, and photo without placeholders", () => {
    expect(resolveMentorCardMajor({})).toBe("");
    expect(resolveMentorCardBio({})).toBe("");
    expect(resolveMentorCardGraduationYear({})).toBe("");
    expect(resolveMentorCardPhoto({})).toBe("");
  });

  it("uses matching-profile avatar when account profile photo is missing", () => {
    const mentor = enrichAssignedMentorMatch(
      { id: "match-3", mentor_name: "Casey", mentor_id: "mentor-c", student_id: "student-3" },
      {
        mentor_user_id: "mentor-c",
        display_name: "Casey Mentor",
        avatar_url: "https://cdn.example.com/casey.webp",
        college: "Brown",
        major: "Economics"
      },
      { id: "mentor-c", full_name: "Casey Mentor", avatar_url: null }
    );

    expect(resolveMentorCardPhoto(mentor)).toBe("https://cdn.example.com/casey.webp");
    expect(mentor.avatarUrl).toBe("https://cdn.example.com/casey.webp");
  });
});

describe("demo assigned mentor card shape", () => {
  it("exposes settings-shaped fields for the demo assigned mentor without inventing empty tags", () => {
    expect(SHARED_MENTOR.college).toBeTruthy();
    expect(SHARED_MENTOR.specialties.length).toBeGreaterThan(0);
    expect(buildMentorCollegeLine(SHARED_MENTOR)[0]).toBe(SHARED_MENTOR.college);
    expect(buildMentorCollegeLine(SHARED_MENTOR).length).toBeLessThanOrEqual(3);
    const tags = pickStableMentorCardTags(SHARED_MENTOR);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      expect([
        ...SHARED_MENTOR.specialties,
        ...SHARED_MENTOR.targetMajors,
        ...SHARED_MENTOR.supportStyles
      ]).toContain(tag);
    }
  });
});
