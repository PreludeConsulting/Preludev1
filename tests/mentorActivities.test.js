import { beforeEach, describe, expect, it } from "vitest";
import {
  activityPrimaryAction,
  activityTypeLabel,
  createMentorActivity,
  formatFileSize,
  isValidDocumentLink,
  listMentorActivities,
  listStudentActivities,
  resolveActivityFileMime,
  reviewMentorActivity,
  saveActivitySubmission,
  statusLabel,
  validateActivityFile
} from "../src/lib/mentorActivitiesApi.js";
import { resetDemoMentorActivities } from "../src/lib/demoMentorActivities.js";

const demoMentor = { id: "demo-mentor", email: "mentor@prelude-demo.com", role: "mentor", authProvider: "demo" };
const demoStudent = { id: "demo-student", email: "jordan-basic@prelude-demo.com", role: "student", plan: "basic", authProvider: "demo" };

beforeEach(() => resetDemoMentorActivities());

describe("mentor-assigned activity client helpers", () => {
  it("validates only shared HTTP(S) document links", () => {
    expect(isValidDocumentLink("https://docs.google.com/document/d/example")).toBe(true);
    expect(isValidDocumentLink("http://example.com/draft.docx")).toBe(true);
    expect(isValidDocumentLink("javascript:alert(1)")).toBe(false);
    expect(isValidDocumentLink("docs.google.com/document/d/example")).toBe(false);
  });

  it("validates PDF, DOC, and DOCX files by extension and MIME type", () => {
    const pdf = { name: "essay.pdf", type: "application/pdf", size: 1024 };
    expect(resolveActivityFileMime(pdf)).toBe("application/pdf");
    expect(validateActivityFile(pdf)).toBeNull();
    expect(validateActivityFile({ ...pdf, name: "essay.exe" })).toMatch(/PDF, DOC, and DOCX/);
    expect(validateActivityFile({ ...pdf, size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });

  it("uses the requested activity labels and status actions", () => {
    expect(activityTypeLabel("personal_statement")).toBe("Personal Statement Review");
    expect(statusLabel("needs_revision")).toBe("Needs Revision");
    expect(activityPrimaryAction("not_started")).toBe("Open Activity");
    expect(activityPrimaryAction("in_progress")).toBe("Continue");
    expect(activityPrimaryAction("submitted")).toBe("View Submission");
    expect(activityPrimaryAction("needs_revision")).toBe("Revise Submission");
    expect(formatFileSize(1_048_576)).toBe("1.0 MB");
  });

  it("supports the assign, submit, and review workflow across demo accounts", async () => {
    const mentorView = await listMentorActivities(undefined, demoMentor);
    expect(mentorView.students.map((student) => student.displayName)).toEqual([
      "Jordan — Essay Support",
      "Jordan — Plus",
      "Jordan — Pro"
    ]);
    const jordan = mentorView.students.find((student) => student.id === "demo-student-jordan-essay");
    expect(jordan.essaySupportOnly).toBe(true);
    expect(jordan.reviewCredits.remaining).toBe(4);
    expect(jordan.usageSummary).toBe("4 review credits remaining");
    expect(mentorView.students.find((student) => student.id === "demo-student-jordan-plus").sessionAllowance)
      .toEqual({ included: 2, used: 1, remaining: 1 });
    expect(mentorView.students.find((student) => student.id === "demo-student-jordan-pro").usageSummary)
      .toBe("3 of 4 sessions remaining");

    const created = await createMentorActivity({
      studentId: "demo-student-jordan-essay",
      activityType: "personal_statement",
      title: "Demo Workflow Essay",
      collegeName: null,
      essayPrompt: "Tell us about a meaningful project.",
      wordLimit: 500,
      instructions: "Submit a shareable document link.",
      dueDate: null,
      allowedSubmissionMethod: "document_link"
    }, demoMentor);

    expect(created.activity.usesReviewCredit).toBe(true);
    expect(created.reviewCredits.remaining).toBe(3);

    const studentView = await listStudentActivities(demoStudent);
    expect(studentView.activities.some((activity) => activity.id === created.activity.id)).toBe(true);

    await saveActivitySubmission(created.activity.id, {
      submissionMethod: "document_link",
      documentUrl: "https://docs.google.com/document/d/demo-workflow",
      isDraft: false
    }, "demo-idempotency-key", demoStudent);

    const submitted = (await listMentorActivities(undefined, demoMentor)).activities
      .find((activity) => activity.id === created.activity.id);
    expect(submitted.status).toBe("submitted");

    await reviewMentorActivity(created.activity.id, {
      status: "completed",
      feedbackText: "Strong draft.",
      submissionId: submitted.submissions[0].id
    }, demoMentor);

    const completed = (await listStudentActivities(demoStudent)).activities
      .find((activity) => activity.id === created.activity.id);
    expect(completed.status).toBe("completed");
    expect(completed.submissions[0].feedback[0].feedbackText).toBe("Strong draft.");
  });

  it("limits Essay Support demo students to review activities and remaining credits", async () => {
    const mentorView = await listMentorActivities(undefined, demoMentor);
    const jordan = mentorView.students.find((student) => student.id === "demo-student-jordan-essay");
    const jordanPlus = mentorView.students.find((student) => student.id === "demo-student-jordan-plus");
    expect(jordan.essaySupportOnly).toBe(true);
    expect(jordanPlus.essaySupportOnly).toBe(false);
    expect(jordan.reviewCredits).toEqual({ purchased: 6, assigned: 2, remaining: 4 });

    await expect(createMentorActivity({
      studentId: "demo-student-jordan-essay",
      activityType: "activities_list",
      title: "Should Fail",
      allowedSubmissionMethod: "document_link"
    }, demoMentor)).rejects.toThrow(/not available for this student’s plan/i);

    const multiPrompt = await createMentorActivity({
      studentId: "demo-student-jordan-essay",
      activityType: "supplemental_essay",
      title: "Georgia Tech Supplemental Essay Review",
      collegeName: "Georgia Tech",
      prompts: [
        { promptText: "Why Tech?", optionalWordLimit: 150 },
        { promptText: "Describe a community you care about.", optionalWordLimit: 200 }
      ],
      allowedSubmissionMethod: "either"
    }, demoMentor);
    expect(multiPrompt.activity.prompts).toHaveLength(2);
    expect(multiPrompt.activity.reviewCreditsUsed).toBe(1);
    expect(multiPrompt.reviewCredits.remaining).toBe(3);

    const plusStyle = await createMentorActivity({
      studentId: "demo-student-jordan-plus",
      activityType: "resume",
      title: "Résumé Review",
      allowedSubmissionMethod: "document_link"
    }, demoMentor);
    expect(plusStyle.activity.usesReviewCredit).toBe(false);
    expect(plusStyle.sessionAllowance).toEqual({ included: 2, used: 1, remaining: 1 });

    for (let i = 0; i < 3; i += 1) {
      await createMentorActivity({
        studentId: "demo-student-jordan-essay",
        activityType: "personal_statement",
        title: `Extra Review ${i + 1}`,
        allowedSubmissionMethod: "either"
      }, demoMentor);
    }

    const depleted = await listMentorActivities(undefined, demoMentor);
    expect(depleted.students.find((student) => student.id === "demo-student-jordan-essay").reviewCredits.remaining).toBe(0);

    await expect(createMentorActivity({
      studentId: "demo-student-jordan-essay",
      activityType: "personal_statement",
      title: "Overspend",
      allowedSubmissionMethod: "either"
    }, demoMentor)).rejects.toThrow(/no Essay Support review credits remaining/i);
  });
});
