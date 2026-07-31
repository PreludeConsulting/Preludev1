import { getDemoAccountByEmail, isDemoEmail } from "../data/demoAccounts.js";
import { DEMO_SLUGS } from "../data/demoDashboardData.js";

const STORAGE_KEY = "prelude_demo_mentor_activities_v3";
const DEMO_MENTOR_ID = DEMO_SLUGS.mentor;
const DEMO_UPLOADS = new Map();
const ESSAY_REVIEW_TYPES = new Set(["personal_statement", "supplemental_essay"]);
const DEMO_ESSAY_SUPPORT_PURCHASED = 6;
let memoryState = null;

const DEMO_STUDENTS = [
  {
    id: DEMO_SLUGS.jordanEssay,
    name: "Jordan Lee",
    displayName: "Jordan — Essay Support",
    grade: "11th grade",
    colleges: ["Brown University", "Georgia Tech", "UCLA"],
    plan: "basic",
    planLabel: "Essay Support",
    essaySupportOnly: true
  },
  {
    id: DEMO_SLUGS.jordanPlus,
    name: "Jordan Lee",
    displayName: "Jordan — Plus",
    grade: "11th grade",
    plan: "plus",
    planLabel: "Plus",
    essaySupportOnly: false
  },
  {
    id: DEMO_SLUGS.jordanPro,
    name: "Jordan Lee",
    displayName: "Jordan — Pro",
    grade: "11th grade",
    plan: "pro",
    planLabel: "Pro",
    essaySupportOnly: false
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

function emptyCredits(purchased = 0) {
  return {
    purchased,
    assigned: 0,
    remaining: purchased
  };
}

function summarizeCredits(state, studentId) {
  const entry = state.credits?.[studentId] || emptyCredits(0);
  return {
    purchased: Math.max(0, Number(entry.purchased) || 0),
    assigned: Math.max(0, Number(entry.assigned) || 0),
    remaining: Math.max(0, Number(entry.remaining) || 0)
  };
}

function summarizeAllowance(state, studentId) {
  const entry = state.allowances?.[studentId] || {};
  const included = Math.max(0, Number(entry.included) || 0);
  const used = Math.max(0, Number(entry.used) || 0);
  return {
    included,
    used,
    remaining: Math.max(0, Number(entry.remaining) || 0)
  };
}

function usesReviewCredit(activityType) {
  return ESSAY_REVIEW_TYPES.has(activityType);
}

function seedState() {
  const brownPrompts = [
    {
      id: "demo-prompt-brown-1",
      promptText: "Brown’s Open Curriculum allows students to explore broadly while also diving deeply into their academic pursuits. Tell us about any academic interests that excite you, and how you might use the Open Curriculum to pursue them while also embracing topics with which you are unfamiliar.",
      optionalWordLimit: 250,
      displayOrder: 0
    },
    {
      id: "demo-prompt-brown-2",
      promptText: "Brown students care deeply about their communities. Tell us about a community that has shaped you, and how you hope to contribute at Brown.",
      optionalWordLimit: 200,
      displayOrder: 1
    },
    {
      id: "demo-prompt-brown-3",
      promptText: "What is something you would like admissions to know that is not reflected elsewhere in your application?",
      optionalWordLimit: 100,
      displayOrder: 2
    }
  ];

  return {
    version: 3,
    credits: {
      [DEMO_SLUGS.jordanEssay]: {
        purchased: DEMO_ESSAY_SUPPORT_PURCHASED,
        assigned: 2,
        remaining: 4
      }
    },
    allowances: {
      [DEMO_SLUGS.jordanPlus]: {
        included: 2,
        used: 1,
        remaining: 1
      },
      [DEMO_SLUGS.jordanPro]: {
        included: 4,
        used: 1,
        remaining: 3
      }
    },
    activities: [
      {
        id: "demo-activity-personal-statement",
        mentorId: DEMO_MENTOR_ID,
        studentId: DEMO_SLUGS.jordanEssay,
        mentorName: "Asim Yoonas",
        studentName: "Jordan Lee",
        title: "Personal Statement Review",
        activityType: "personal_statement",
        collegeName: null,
        essayPrompt: "Describe an experience that changed how you see yourself or your community.",
        wordLimit: 650,
        instructions: "Draft the opening and first two body paragraphs. Focus on a specific moment and use concrete details.",
        dueDate: dateAtOffset(6),
        allowedSubmissionMethod: "either",
        status: "not_started",
        usesReviewCredit: true,
        reviewCreditsUsed: 1,
        prompts: [],
        promptResponses: [],
        createdAt: dateAtOffset(-1, 10),
        updatedAt: dateAtOffset(-1, 10),
        completedAt: null,
        submissions: [],
        feedback: []
      },
      {
        id: "demo-activity-jordan-brown-supplement",
        mentorId: DEMO_MENTOR_ID,
        studentId: DEMO_SLUGS.jordanEssay,
        mentorName: "Asim Yoonas",
        studentName: "Jordan Lee",
        title: "Brown University Supplemental Essay Review",
        activityType: "supplemental_essay",
        collegeName: "Brown University",
        essayPrompt: brownPrompts[0].promptText,
        wordLimit: brownPrompts[0].optionalWordLimit,
        instructions: "Respond to every Brown prompt below. Keep answers specific to Brown’s Open Curriculum and community.",
        dueDate: dateAtOffset(5),
        allowedSubmissionMethod: "either",
        status: "not_started",
        usesReviewCredit: true,
        reviewCreditsUsed: 1,
        prompts: brownPrompts,
        promptResponses: [],
        createdAt: dateAtOffset(-2, 11),
        updatedAt: dateAtOffset(-2, 11),
        completedAt: null,
        submissions: [],
        feedback: []
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
    if (parsed?.version === 3 && Array.isArray(parsed.activities) && parsed.credits && parsed.allowances) return parsed;
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
  const account = getDemoAccountByEmail(user?.email);
  if (!account) return null;
  if (account.email === "jordan-basic@prelude-demo.com") return DEMO_SLUGS.jordanEssay;
  if (account.email === "jordan-pro@prelude-demo.com") return DEMO_SLUGS.jordanPro;
  if (account.email === "jordan-plus@prelude-demo.com" || account.email === "student@prelude-demo.com") {
    return DEMO_SLUGS.jordanPlus;
  }
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
  return {
    ...clone(activity),
    storedStatus: activity.status,
    status: displayStatus(activity),
    usesReviewCredit: Boolean(activity.usesReviewCredit),
    reviewCreditsUsed: Number(activity.reviewCreditsUsed) || (activity.usesReviewCredit ? 1 : 0),
    prompts: Array.isArray(activity.prompts) ? activity.prompts : [],
    promptResponses: Array.isArray(activity.promptResponses) ? activity.promptResponses : []
  };
}

function sortedActivities(activities) {
  return [...activities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(hydrate);
}

function mapDemoStudents(state) {
  return DEMO_STUDENTS.map((student) => {
    const reviewCredits = student.essaySupportOnly ? summarizeCredits(state, student.id) : null;
    const sessionAllowance = student.essaySupportOnly ? null : summarizeAllowance(state, student.id);
    return {
      ...clone(student),
      reviewCredits,
      sessionAllowance,
      usageSummary: student.essaySupportOnly
        ? `${reviewCredits.remaining} review credits remaining`
        : `${sessionAllowance.remaining} of ${sessionAllowance.included} sessions remaining`
    };
  });
}

function reserveDemoReviewCredit(state, student) {
  if (!student.essaySupportOnly) return null;
  const credits = summarizeCredits(state, student.id);
  if (credits.remaining < 1) {
    throw new Error("This student has no Essay Support review credits remaining.");
  }
  state.credits = state.credits || {};
  state.credits[student.id] = {
    purchased: credits.purchased,
    assigned: credits.assigned + 1,
    remaining: credits.remaining - 1
  };
  return state.credits[student.id];
}

export function isDemoActivityUser(user) {
  return Boolean(user && (user.authProvider === "demo" || user.authProvider === "dev" || isDemoEmail(user.email)));
}

export function isDemoEssaySupportStudent(user) {
  if (!isDemoActivityUser(user) || roleOf(user) !== "student") return false;
  const studentId = demoStudentId(user);
  if (studentId !== DEMO_SLUGS.jordanEssay) return false;
  const plan = String(user?.plan || "").toLowerCase();
  if (plan === "plus" || plan === "pro") return false;
  return true;
}

export async function listDemoMentorActivities(user, status = "all") {
  assertDemoActor(user, ["mentor", "student"]);
  const state = readState();
  let activities = roleOf(user) === "mentor"
    ? state.activities
    : state.activities.filter((activity) => activity.studentId === demoStudentId(user));
  if (status && status !== "all") activities = activities.filter((activity) => activity.status === status);
  const studentId = demoStudentId(user);
  const student = DEMO_STUDENTS.find((item) => item.id === studentId) || null;
  const reviewCredits = student?.essaySupportOnly ? summarizeCredits(state, student.id) : null;
  const sessionAllowance = student && !student.essaySupportOnly ? summarizeAllowance(state, student.id) : null;
  return {
    activities: sortedActivities(activities),
    students: roleOf(user) === "mentor" ? mapDemoStudents(state) : [],
    reviewCredits,
    sessionAllowance,
    usageSummary: reviewCredits
      ? `${reviewCredits.remaining} review credits remaining`
      : sessionAllowance
        ? `${sessionAllowance.remaining} of ${sessionAllowance.included} sessions remaining`
        : null,
    essaySupportOnly: Boolean(student?.essaySupportOnly),
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

  if (student.essaySupportOnly && !ESSAY_REVIEW_TYPES.has(payload.activityType)) {
    throw new Error("This activity type is not available for this student’s plan.");
  }

  const prompts = payload.activityType === "supplemental_essay"
    ? (Array.isArray(payload.prompts) && payload.prompts.length
        ? payload.prompts.map((prompt, displayOrder) => ({
            id: id("demo-prompt"),
            promptText: String(prompt.promptText || "").trim(),
            optionalWordLimit: prompt.optionalWordLimit ? Number(prompt.optionalWordLimit) : null,
            displayOrder
          }))
        : (payload.essayPrompt
            ? [{
                id: id("demo-prompt"),
                promptText: String(payload.essayPrompt).trim(),
                optionalWordLimit: payload.wordLimit || null,
                displayOrder: 0
              }]
            : []))
    : [];

  if (payload.activityType === "supplemental_essay") {
    if (!String(payload.collegeName || "").trim()) {
      throw new Error("College is required for supplemental essay reviews.");
    }
    if (!prompts.length || prompts.some((prompt) => !prompt.promptText)) {
      throw new Error("Add at least one supplemental essay prompt.");
    }
  }

  const state = readState();
  const reserved = reserveDemoReviewCredit(state, student);
  const now = new Date().toISOString();
  const activity = {
    id: id("demo-activity"),
    mentorId: DEMO_MENTOR_ID,
    studentId: student.id,
    mentorName: "Asim Yoonas",
    studentName: student.name,
    title: payload.title,
    activityType: payload.activityType,
    collegeName: payload.collegeName || null,
    essayPrompt: prompts[0]?.promptText || payload.essayPrompt || null,
    wordLimit: prompts[0]?.optionalWordLimit || payload.wordLimit || null,
    instructions: payload.instructions || null,
    dueDate: payload.dueDate || null,
    allowedSubmissionMethod: payload.allowedSubmissionMethod || "either",
    status: "not_started",
    usesReviewCredit: Boolean(reserved) || (student.essaySupportOnly && usesReviewCredit(payload.activityType)),
    reviewCreditsUsed: reserved ? 1 : 0,
    prompts,
    promptResponses: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    submissions: [],
    feedback: []
  };
  state.activities.push(activity);
  writeState(state);
  return {
    activity: hydrate(activity),
    reviewCredits: student.essaySupportOnly ? summarizeCredits(state, student.id) : null,
    sessionAllowance: student.essaySupportOnly ? null : summarizeAllowance(state, student.id),
    demo: true
  };
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

export async function saveDemoActivityPromptResponses(user, activityId, responses = []) {
  const state = readState();
  const activity = findActivity(state, activityId);
  assertOwnStudentActivity(user, activity);
  if (activity.status === "completed") throw new Error("This activity is already completed.");
  const promptIds = new Set((activity.prompts || []).map((prompt) => prompt.id));
  const now = new Date().toISOString();
  activity.promptResponses = (responses || []).map((response) => {
    if (!promptIds.has(response.promptId)) {
      throw new Error("One or more prompt responses do not belong to this activity.");
    }
    return {
      id: id("demo-prompt-response"),
      promptId: response.promptId,
      activityId,
      studentId: activity.studentId,
      responseText: String(response.responseText || ""),
      submissionStatus: response.submissionStatus || "draft",
      savedAt: now,
      submittedAt: response.submissionStatus === "submitted" ? now : null
    };
  });
  const allSubmitted =
    activity.promptResponses.length === promptIds.size &&
    activity.promptResponses.every((response) => response.submissionStatus === "submitted");
  activity.status = allSubmitted ? "submitted" : "in_progress";
  activity.updatedAt = now;
  writeState(state);
  return { activity: hydrate(activity), demo: true };
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
    mentorName: "Asim Yoonas",
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
    globalThis.localStorage?.removeItem("prelude_demo_mentor_activities_v1");
    globalThis.localStorage?.removeItem("prelude_demo_mentor_activities_v2");
  } catch {
    // Ignore storage restrictions.
  }
  for (const uploadUrl of DEMO_UPLOADS.values()) URL.revokeObjectURL(uploadUrl);
  DEMO_UPLOADS.clear();
  memoryState = null;
}
