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
const demoStudent = { id: "demo-student", email: "student@prelude-demo.com", role: "student", authProvider: "demo" };

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
    expect(activityTypeLabel("personal_statement")).toBe("Personal Statement");
    expect(statusLabel("needs_revision")).toBe("Needs Revision");
    expect(activityPrimaryAction("not_started")).toBe("Open Activity");
    expect(activityPrimaryAction("in_progress")).toBe("Continue");
    expect(activityPrimaryAction("submitted")).toBe("View Submission");
    expect(activityPrimaryAction("needs_revision")).toBe("Revise Submission");
    expect(formatFileSize(1_048_576)).toBe("1.0 MB");
  });

  it("supports the assign, submit, and review workflow across demo accounts", async () => {
    const mentorView = await listMentorActivities(undefined, demoMentor);
    expect(mentorView.students.map((student) => student.name)).toEqual(["Jordan Lee", "Alex Kim"]);

    const created = await createMentorActivity({
      studentId: "demo-student-jordan",
      activityType: "personal_statement",
      title: "Demo Workflow Essay",
      collegeName: null,
      essayPrompt: "Tell us about a meaningful project.",
      wordLimit: 500,
      instructions: "Submit a shareable document link.",
      dueDate: null,
      allowedSubmissionMethod: "document_link"
    }, demoMentor);

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
});
