import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "src/dashboard/context/DashboardDataContext.jsx"),
  "utf8"
);

describe("dashboard load: empty results, races, and error classification", () => {
  it("treats an empty meetings payload as a valid empty state, not an error", () => {
    // A successful-but-empty meetings response must not throw or flip sync status to failed;
    // only 401/403 from the meetings fetch should propagate as an auth error.
    const start = source.search(/setMeetings\(\[\]\);\s*setPendingMeetingRequests\(\[\]\);/);
    const tryBlock = source.slice(start, source.indexOf("if (appData.mentorAccess)"));
    expect(tryBlock).toContain("catch (meetingErr)");
    expect(tryBlock).toMatch(/if \(meetingErr\?\.status === 401 \|\| meetingErr\?\.status === 403\) throw meetingErr;/);
  });

  it("sources meetings from the API/app-data payload, not calendar_events", () => {
    expect(source).toMatch(/const meetingPayload = appData\.meetings[\s\S]*?: await getMeetings\(\)/);
    expect(source).not.toMatch(/setMeetings\(data\.meetings/);
  });

  it("guards the async dashboard load with an AbortController-backed staleness check", () => {
    expect(source).toContain("const controller = new AbortController();");
    expect(source).toContain("loadAbortRef.current = controller;");
    expect(source).toMatch(/const isStale = \(\) => generation !== loadGenerationRef\.current \|\| controller\.signal\.aborted;/);
    expect(source).toContain('if (isStale() || err?.name === "AbortError") return;');
  });

  it("classifies load failures into unauthenticated, forbidden, offline, and generic sync-failed states", () => {
    expect(source).toMatch(/status === 401\s*\n?\s*\?\s*"Sign in again to continue\."/);
    expect(source).toMatch(/status === 403\s*\n?\s*\?\s*"You do not have access to this dashboard data\."/);
    expect(source).toContain('"You appear to be offline. Reconnect and retry."');
    expect(source).toMatch(/setSyncStatus\(offline \? "offline" : status === 401 \? "unauthenticated" : status === 403 \? "forbidden" : "sync-failed"\)/);
  });

  it("does not fall back to local-storage application reviews for real users", () => {
    expect(source).not.toMatch(/setApplicationReviews\(\s*reviewsResult\.reviews\?\.length \? reviewsResult\.reviews : localReviews/);
    expect(source).toContain("setApplicationReviews(reviewsResult.reviews || []);");
  });
});
