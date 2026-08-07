import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("mentor availability + messaging source contracts", () => {
  it("persists availability with service-role clients after mentor authz", () => {
    const nodeApi = fs.readFileSync(path.join(ROOT, "server/supabaseDashboardApi.js"), "utf8");
    const workerApi = fs.readFileSync(path.join(ROOT, "functions/_lib/dashboard.js"), "utf8");
    expect(nodeApi).toMatch(/getAdminClient\s*=\s*getSupabaseAdmin/);
    expect(nodeApi).toMatch(/const admin = getAdminClient\(\)/);
    expect(nodeApi).toMatch(/availability_schedule/);
    expect(workerApi).toMatch(/adminRest\(context,\s*["`]mentor_matching_profiles/);
  });

  it("loads student booking slots from the admin schedule source on Workers", () => {
    const meetings = fs.readFileSync(path.join(ROOT, "functions/_lib/meetings.js"), "utf8");
    expect(meetings).toMatch(/async function loadMentorSchedule/);
    expect(meetings).toMatch(/adminRest\(/);
    expect(meetings).toMatch(/availability_schedule/);
  });

  it("saves onboarding availability through the canonical dashboard endpoint", () => {
    const onboarding = fs.readFileSync(
      path.join(ROOT, "src/components/onboarding/MentorQuestionnaireOnboardingPage.jsx"),
      "utf8"
    );
    expect(onboarding).toMatch(/updateMentorAvailability\(\{/);
    expect(onboarding).toMatch(/timezone:\s*availabilityForm\.timezone/);
    expect(onboarding).toMatch(/days:\s*availabilityForm\.days/);
  });

  it("creates chat threads during admin assignment", () => {
    const nodeAssign = fs.readFileSync(path.join(ROOT, "server/onboardingMentorSelectionApi.js"), "utf8");
    const workerAssign = fs.readFileSync(path.join(ROOT, "functions/_lib/mentorReview.js"), "utf8");
    expect(nodeAssign).toMatch(/syncAssignedMentorStudentChat/);
    expect(workerAssign).toMatch(/syncAssignedMentorStudentChat/);
    expect(nodeAssign).toMatch(/deactivateStudentMentorChats/);
    expect(workerAssign).toMatch(/deactivateStudentMentorChats/);
  });

  it("hides Browse mentor network when the student already has an assigned mentor", () => {
    const page = fs.readFileSync(path.join(ROOT, "src/dashboard/components/chat/PreludeMessagesPage.jsx"), "utf8");
    expect(page).toMatch(/hasAssignedMentor/);
    expect(page).toMatch(/showMentorNetworkBrowse/);
  });
});
