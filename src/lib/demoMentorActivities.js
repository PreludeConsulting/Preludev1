import { isDemoEmail, isJordanDemoEmail } from "../data/demoAccounts.js";
import { DEMO_SLUGS } from "../data/demoDashboardData.js";

const STORAGE_KEY = "prelude_demo_mentor_activities_v1";
const DEMO_MENTOR_ID = DEMO_SLUGS.mentor;
const DEMO_UPLOADS = new Map();
let memoryState = null;

const DEMO_STUDENTS = [
  {
    id: DEMO_SLUGS.jordan,
    name: "Jordan Lee",
    grade: "11th grade",
    colleges: ["Georgia Tech", "UCLA", "University of Michigan"]
  },
  {
    id: DEMO_SLUGS.alex,
    name: "Alex Kim",
    grade: "12th grade",
    colleges: ["NYU", "Boston University", "Emory University"]
  }
];

function id(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function dateAtOffset(days, hour = 17) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function seedState() {
  const submittedAt = dateAtOffset(-2, 19);
  const revisionSubmittedAt = dateAtOffset(-4, 18);
  const feedbackAt = dateAtOffset(-3, 11);
  return {
    version: 1,
    activities: [
      {
        id: "demo-activity-personal-statement",
        mentorId: DEMO_MENTOR_ID,
        studentId: DEMO_SLUGS.jordan,
        mentorName: "Maya Patel",
        studentName: "Jordan Lee",
        title: "Personal Statement Opening",
        activityType: "personal_statement",
        collegeName: null,
        essayPrompt: "Describe an experience that changed how you see yourself or your community.",
        wordLimit: 650,
        instructions: "Draft the opening and first two body paragraphs. Focus on a specific moment and use concrete details.",
        dueDate: dateAtOffset(6),
        allowedSubmissionMethod: "either",
        status: "not_started",
        createdAt: dateAtOffset(-1, 10),
        updatedAt: dateAtOffset(-1, 10),
        completedAt: null,
        submissions: [],
        feedback: []
      },
      {
        id: "demo-activity-alex-supplement",
        mentorId: DEMO_MENTOR_ID,
        studentId: DEMO_SLUGS.alex,
        mentorName: "Maya Patel",
        studentName: "Alex Kim",
        title: "Emory Supplemental Essay",
        activityType: "supplemental_essay",
        collegeName: "Emory University",
        essayPrompt: "What academic areas are you interested in exploring at Emory University and why?",
        wordLimit: 200,
        instructions: "Connect one academic interest to a specific Emory opportunity.",
        dueDate: dateAtOffset(3),
        allowedSubmissionMethod: "document_link",
        status: "submitted",
        createdAt: dateAtOffset(-6, 9),
        updatedAt: submittedAt,
        completedAt: null,
        submissions: [
          {
            id: "demo-submission-alex-supplement",
            activityId: "demo-activity-alex-supplement",
            studentId: DEMO_SLUGS.alex,
            submissionMethod: "document_link",
            documentUrl: "https://docs.google.com/document/d/demo-emory-supplement",
            storagePath: null,
            originalFileName: null,
            fileMimeType: null,
            fileSize: null,
            isDraft: false,
            submittedAt,
            createdAt: submittedAt,
            updatedAt: submittedAt,
            feedback: []
          }
        ],
        feedback: []
      },
      {
        id: "demo-activity-jordan-activities-list",
        mentorId: DEMO_MENTOR_ID,
        studentId: DEMO_SLUGS.jordan,
        mentorName: "Maya Patel",
        studentName: "Jordan Lee",
        title: "Common App Activities List",
        activityType: "activities_list",
        collegeName: null,
        essayPrompt: null,
        wordLimit: null,
        instructions: "Revise the robotics and volunteer entries so each begins with a strong action verb and includes measurable impact.",
        dueDate: dateAtOffset(2),
        allowedSubmissionMethod: "document_link",
        status: "needs_revision",
        createdAt: dateAtOffset(-8, 9),
        updatedAt: feedbackAt,
        completedAt: null,
        submissions: [
          {
            id: "demo-submission-jordan-activities",
            activityId: "demo-activity-jordan-activities-list",
            studentId: DEMO_SLUGS.jordan,
            submissionMethod: "document_link",
            documentUrl: "https://docs.google.com/document/d/demo-activities-list",
            storagePath: null,
            originalFileName: null,
            fileMimeType: null,
            fileSize: null,
            isDraft: false,
            submittedAt: revisionSubmittedAt,
            createdAt: revisionSubmittedAt,
            updatedAt: revisionSubmittedAt,
            feedback: [
              {
                id: "demo-feedback-jordan-activities",
                activityId: "demo-activity-jordan-activities-list",
                submissionId: "demo-submission-jordan-activities",
                mentorId: DEMO_MENTOR_ID,
                mentorName: "Maya Patel",
                feedbackText: "Good foundation. Add the number of students reached and clarify what you personally built for the robotics team.",
                createdAt: feedbackAt,
                updatedAt: feedbackAt
              }
            ]
          }
        ],
        feedback: [
          {
            id: "demo-feedback-jordan-activities",
            activityId: "demo-activity-jordan-activities-list",
            submissionId: "demo-submission-jordan-activities",
            mentorId: DEMO_MENTOR_ID,
            mentorName: "Maya Patel",
            feedbackText: "Good foundation. Add the number of students reached and clarify what you personally built for the robotics team.",
            createdAt: feedbackAt,
            updatedAt: feedbackAt
          }
        ]
      }
    ]
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readState() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version === 1 && Array.isArray(parsed.activities)) return parsed;
  } catch {
    // Private browsing and test environments can deny local storage.
  }
  if (!memoryState) memoryState = seedState();
  writeState(memoryState);
  return clone(memoryState);
}

function writeState(state) {
  memoryState = clone(state);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The in-memory copy still supports the current demo session.
  }
}

function demoStudentId(user) {
  if (isJordanDemoEmail(user?.email)) return DEMO_SLUGS.jordan;
  if ((user?.email || "").toLowerCase() === "student2@prelude-demo.com") return DEMO_SLUGS.alex;
  return null;
}

function roleOf(user) {
  return String(user?.role || "").toLowerCase();
}

function assertDemoActor(user, allowedRoles) {
  if (!isDemoActivityUser(user) || !allowedRoles.includes(roleOf(user))) {
    throw new Error("This demo activity action is not available for the current account.");
  }
}

function findActivity(state, activityId) {
  const activity = state.activities.find((item) => item.id === activityId);
  if (!activity) throw new Error("Activity not found.");
  return activity;
}

function assertOwnStudentActivity(user, activity) {
  assertDemoActor(user, ["student"]);
  if (activity.studentId !== demoStudentId(user)) throw new Error("You do not have access to this activity.");
}

function displayStatus(activity) {
  if (
    activity.dueDate
    && !["submitted", "needs_revision", "completed"].includes(activity.status)
    && new Date(activity.dueDate).getTime() < Date.now()
  ) return "overdue";
  return activity.status;
}

function hydrate(activity) {
  return { ...clone(activity), storedStatus: activity.status, status: displayStatus(activity) };
}

function sortedActivities(activities) {
  return [...activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(hydrate);
}

export function isDemoActivityUser(user) {
  return Boolean(user && (user.authProvider === "demo" || user.authProvider === "dev" || isDemoEmail(user.email)));
}

export async function listDemoMentorActivities(user, status = "all") {
  assertDemoActor(user, ["mentor", "student"]);
  const state = readState();
  let activities = roleOf(user) === "mentor"
    ? state.activities
    : state.activities.filter((activity) => activity.studentId === demoStudentId(user));
  if (status && status !== "all") activities = activities.filter((activity) => activity.status === status);
  return {
    activities: sortedActivities(activities),
    students: roleOf(user) === "mentor" ? clone(DEMO_STUDENTS) : [],
    role: roleOf(user),
    demo: true
  };
}

export async function getDemoMentorActivity(user, activityId) {
  const state = readState();
  const activity = findActivity(state, activityId);
  if (roleOf(user) === "student") assertOwnStudentActivity(user, activity);
  else assertDemoActor(user, ["mentor"]);
  return { activity: hydrate(activity), demo: true };
}

export async function createDemoMentorActivity(user, payload) {
  assertDemoActor(user, ["mentor"]);
  const student = DEMO_STUDENTS.find((item) => item.id === payload.studentId);
  if (!student) throw new Error("Choose an assigned demo student.");
  const now = new Date().toISOString();
  const activity = {
    id: id("demo-activity"),
    mentorId: DEMO_MENTOR_ID,
    studentId: student.id,
    mentorName: "Maya Patel",
    studentName: student.name,
    title: payload.title,
    activityType: payload.activityType,
    collegeName: payload.collegeName || null,
    essayPrompt: payload.essayPrompt || null,
    wordLimit: payload.wordLimit || null,
    instructions: payload.instructions || null,
    dueDate: payload.dueDate || null,
    allowedSubmissionMethod: payload.allowedSubmissionMethod || "either",
    status: "not_started",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    submissions: [],
    feedback: []
  };
  const state = readState();
  state.activities.push(activity);
  writeState(state);
  return { activity: hydrate(activity), demo: true };
}

export async function updateDemoMentorActivity(user, activityId, payload) {
  assertDemoActor(user, ["mentor"]);
  const state = readState();
  const activity = findActivity(state, activityId);
  Object.assign(activity, payload, { updatedAt: new Date().toISOString() });
  writeState(state);
  return { activity: hydrate(activity), demo: true };
}

export async function saveDemoActivitySubmission(user, activityId, payload, idempotencyKey) {
  const state = readState();
  const activity = findActivity(state, activityId);
  assertOwnStudentActivity(user, activity);
  if (activity.status === "completed") throw new Error("This activity is already completed.");
  if (activity.allowedSubmissionMethod !== "either" && activity.allowedSubmissionMethod !== payload.submissionMethod) {
    throw new Error("This submission method is not allowed for the activity.");
  }
  const duplicate = !payload.isDraft && idempotencyKey
    ? activity.submissions.find((submission) => submission.idempotencyKey === idempotencyKey)
    : null;
  if (duplicate) return { submission: clone(duplicate), activity: hydrate(activity), duplicate: true, demo: true };

  const now = new Date().toISOString();
  const draftIndex = activity.submissions.findIndex((submission) => submission.isDraft);
  const submission = {
    id: draftIndex >= 0 ? activity.submissions[draftIndex].id : id("demo-submission"),
    activityId,
    studentId: activity.studentId,
    submissionMethod: payload.submissionMethod,
    documentUrl: payload.submissionMethod === "document_link" ? payload.documentUrl : null,
    storagePath: payload.submissionMethod === "file_upload" ? payload.storagePath : null,
    originalFileName: payload.submissionMethod === "file_upload" ? payload.originalFileName : null,
    fileMimeType: payload.submissionMethod === "file_upload" ? payload.fileMimeType : null,
    fileSize: payload.submissionMethod === "file_upload" ? payload.fileSize : null,
    isDraft: Boolean(payload.isDraft),
    idempotencyKey: payload.isDraft ? null : idempotencyKey,
    submittedAt: payload.isDraft ? null : now,
    createdAt: draftIndex >= 0 ? activity.submissions[draftIndex].createdAt : now,
    updatedAt: now,
    feedback: []
  };
  if (draftIndex >= 0) activity.submissions.splice(draftIndex, 1, submission);
  else activity.submissions.unshift(submission);
  activity.status = payload.isDraft && activity.status === "needs_revision" ? "needs_revision" : payload.isDraft ? "in_progress" : "submitted";
  activity.updatedAt = now;
  writeState(state);
  return { submission: clone(submission), activity: hydrate(activity), duplicate: false, demo: true };
}

export async function requestDemoActivityUpload(user, activityId, file) {
  const state = readState();
  const activity = findActivity(state, activityId);
  assertOwnStudentActivity(user, activity);
  const safeName = String(file.name || "document").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${activity.studentId}/${activity.id}/${id("upload")}-${safeName}`;
  return { path, signedUrl: `demo-upload:${encodeURIComponent(path)}`, fileName: safeName, maxBytes: 10 * 1024 * 1024, demo: true };
}

export async function storeDemoActivityUpload(signedUrl, file, onProgress) {
  const path = decodeURIComponent(String(signedUrl).slice("demo-upload:".length));
  const prior = DEMO_UPLOADS.get(path);
  if (prior) URL.revokeObjectURL(prior);
  DEMO_UPLOADS.set(path, URL.createObjectURL(file));
  onProgress?.(100);
}

export async function removeDemoActivityDraftFile(user, activityId, storagePath) {
  const state = readState();
  const activity = findActivity(state, activityId);
  assertOwnStudentActivity(user, activity);
  activity.submissions = activity.submissions.filter((submission) => !submission.isDraft || submission.storagePath !== storagePath);
  const uploadUrl = DEMO_UPLOADS.get(storagePath);
  if (uploadUrl) URL.revokeObjectURL(uploadUrl);
  DEMO_UPLOADS.delete(storagePath);
  writeState(state);
  return { removed: true, demo: true };
}

export async function getDemoActivityFileUrl(user, activityId, submissionId) {
  const state = readState();
  const activity = findActivity(state, activityId);
  if (roleOf(user) === "student") assertOwnStudentActivity(user, activity);
  else assertDemoActor(user, ["mentor"]);
  const submission = activity.submissions.find((item) => item.id === submissionId);
  if (!submission?.storagePath) throw new Error("Submission file not found.");
  const signedUrl = DEMO_UPLOADS.get(submission.storagePath);
  if (!signedUrl) throw new Error("Demo uploads are available until this browser tab is refreshed. Upload the file again to continue testing.");
  return { signedUrl, expiresIn: 300, demo: true };
}

function addFeedbackRecord(activity, submissionId, feedbackText) {
  const now = new Date().toISOString();
  const feedback = {
    id: id("demo-feedback"),
    activityId: activity.id,
    submissionId: submissionId || null,
    mentorId: DEMO_MENTOR_ID,
    mentorName: "Maya Patel",
    feedbackText,
    createdAt: now,
    updatedAt: now
  };
  activity.feedback.unshift(feedback);
  if (submissionId) {
    const submission = activity.submissions.find((item) => item.id === submissionId);
    if (submission) submission.feedback.unshift(feedback);
  }
  return feedback;
}

export async function addDemoActivityFeedback(user, activityId, payload) {
  assertDemoActor(user, ["mentor"]);
  const state = readState();
  const activity = findActivity(state, activityId);
  const feedback = addFeedbackRecord(activity, payload.submissionId, payload.feedbackText);
  activity.updatedAt = feedback.createdAt;
  writeState(state);
  return { feedback: clone(feedback), demo: true };
}

export async function reviewDemoMentorActivity(user, activityId, payload) {
  assertDemoActor(user, ["mentor"]);
  const state = readState();
  const activity = findActivity(state, activityId);
  const submission = activity.submissions.find((item) => item.id === payload.submissionId && !item.isDraft);
  if (!submission) throw new Error("Choose a submitted revision to review.");
  if (payload.status === "needs_revision" && !payload.feedbackText?.trim()) {
    throw new Error("Feedback is required when requesting a revision.");
  }
  if (payload.feedbackText?.trim()) addFeedbackRecord(activity, submission.id, payload.feedbackText.trim());
  const now = new Date().toISOString();
  activity.status = payload.status;
  activity.completedAt = payload.status === "completed" ? now : null;
  activity.updatedAt = now;
  writeState(state);
  return { activity: hydrate(activity), demo: true };
}

export function resetDemoMentorActivities() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage restrictions.
  }
  for (const uploadUrl of DEMO_UPLOADS.values()) URL.revokeObjectURL(uploadUrl);
  DEMO_UPLOADS.clear();
  memoryState = null;
}
