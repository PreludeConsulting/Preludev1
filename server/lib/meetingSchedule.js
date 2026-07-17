import { z } from "zod";
import { db } from "../authApi.js";
import { PrismaClient } from "@prisma/client";
import {
  createMeetingRecord,
  findMeetingByIdempotencyKey,
  getMeetingById,
  listMeetingsForUser,
  updateMeetingRecord
} from "./meetingStore.js";
import {
  assertMentorRequestAccess,
  canRequestMentor,
  releasePackageSession,
  reserveAccessForMeeting
} from "./mentorAccess.js";
import { isDatabaseUnavailableError } from "./dbErrors.js";

const meetingTypeSchema = z.enum(["zoom", "google_meet", "in_person", "phone"]);
const meetingStatusSchema = z.enum(["scheduled", "pending", "approved", "declined", "canceled", "rescheduled"]);

const zoomJoinUrlSchema = z.string().trim().url().max(2048).optional();

const createMeetingSchema = z.object({
  title: z.string().trim().min(1).max(180),
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  meetingType: meetingTypeSchema.default("zoom"),
  timeZone: z.string().trim().min(1).max(64).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: meetingStatusSchema.optional(),
  studentId: z.string().trim().max(80).optional(),
  mentorId: z.string().trim().max(80).optional(),
  studentUserId: z.string().uuid().optional(),
  mentorUserId: z.string().uuid().optional(),
  isPrivate: z.boolean().optional(),
  zoomJoinUrl: zoomJoinUrlSchema,
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  clientRequestId: z.string().trim().min(8).max(128).optional()
});

const updateMeetingSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  startTime: z.string().datetime({ offset: true }).optional(),
  endTime: z.string().datetime({ offset: true }).optional(),
  meetingType: meetingTypeSchema.optional(),
  timeZone: z.string().trim().min(1).max(64).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: meetingStatusSchema.optional(),
  isPrivate: z.boolean().optional(),
  zoomJoinUrl: zoomJoinUrlSchema
});

function prismaClient() {
  if (!globalThis.__preludePrisma) globalThis.__preludePrisma = new PrismaClient();
  return globalThis.__preludePrisma;
}

function canUsePrisma() {
  return Boolean(process.env.DATABASE_URL);
}

function userFacingError(message, statusCode = 400, code = "validation_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function isValidZoomJoinUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "zoom.us" || host.endsWith(".zoom.us");
  } catch {
    return false;
  }
}

function isValidGoogleMeetJoinUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    return parsed.hostname.toLowerCase() === "meet.google.com";
  } catch {
    return false;
  }
}

function isVideoMeetingType(meetingType) {
  return meetingType === "zoom" || meetingType === "google_meet";
}

function isValidMeetingJoinUrl(url, meetingType) {
  if (meetingType === "google_meet") return isValidGoogleMeetJoinUrl(url);
  if (meetingType === "zoom") return isValidZoomJoinUrl(url);
  return isValidZoomJoinUrl(url) || isValidGoogleMeetJoinUrl(url);
}

function resolveIdempotencyKey(body, req) {
  return (
    body.idempotencyKey ||
    body.clientRequestId ||
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    null
  );
}

function validateTimes(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw userFacingError("Meeting time is invalid.");
  }
  if (end <= start) {
    throw userFacingError("Meeting end time must be after the start time.");
  }
  const maxFuture = Date.now() + 365 * 24 * 60 * 60 * 1000;
  if (start.getTime() < Date.now() - 5 * 60 * 1000) {
    throw userFacingError("Meeting must be scheduled in the future.");
  }
  if (start.getTime() > maxFuture) {
    throw userFacingError("Meeting is too far in the future.");
  }
}

function assertVideoLinkWhenRequired({ role, meetingType, status, zoomJoinUrl }) {
  if (!isVideoMeetingType(meetingType)) return;
  if (status !== "scheduled" && status !== "approved") return;
  if (role?.toUpperCase() === "STUDENT") return;
  const label = meetingType === "google_meet" ? "Google Meet" : "Zoom";
  const example =
    meetingType === "google_meet"
      ? "https://meet.google.com/abc-defg-hij"
      : "https://zoom.us/j/… or https://….zoom.us/j/…";
  if (!isValidMeetingJoinUrl(zoomJoinUrl, meetingType)) {
    throw userFacingError(
      `Paste a valid ${label} meeting link (${example}).`,
      400,
      "validation_error"
    );
  }
}

async function assertMentorStudentAccess({ mentorUserId, studentUserId }) {
  if (!mentorUserId || !studentUserId) return;
  try {
    const assignment = await db().mentorAssignment.findFirst({
      where: {
        active: true,
        mentorProfile: { userId: mentorUserId },
        studentProfile: { userId: studentUserId }
      },
      select: { id: true }
    });
    if (!assignment) {
      throw userFacingError("You do not have permission to schedule with this student.", 403, "forbidden");
    }
  } catch (error) {
    if (error.statusCode) throw error;
  }
}

function canUserAccessMeeting(user, meeting) {
  const role = user.role?.toUpperCase();
  if (role === "ADMIN") return true;
  if (role === "MENTOR") {
    if (meeting.mentorUserId) return meeting.mentorUserId === user.id;
    return meeting.status === "pending" || meeting.status === "approved";
  }
  if (role === "STUDENT") return meeting.studentUserId === user.id && !meeting.isPrivate;
  return false;
}

function normalizeCreatePayload(body, user) {
  const role = user.role?.toUpperCase();
  const payload = {
    ...body,
    studentUserId: body.studentUserId || (role === "STUDENT" ? user.id : undefined),
    mentorUserId: body.mentorUserId || (role === "MENTOR" ? user.id : undefined),
    status: body.status || (role === "STUDENT" ? "pending" : "scheduled"),
    zoomJoinUrl: body.zoomJoinUrl?.trim() || null
  };

  if (role === "STUDENT" && payload.status === "scheduled" && isVideoMeetingType(payload.meetingType)) {
    payload.status = "pending";
    payload.zoomJoinUrl = null;
  }

  return payload;
}

function isStudentMentorRequest(role, payload) {
  return role === "STUDENT" && (payload.status === "pending" || payload.status === "scheduled");
}

function shouldReleasePackageOnStatus(nextStatus) {
  const status = String(nextStatus || "").toLowerCase();
  return status === "canceled" || status === "cancelled" || status === "declined";
}

export async function scheduleMeeting(body, user, req) {
  const parsed = createMeetingSchema.parse(body);
  validateTimes(parsed.startTime, parsed.endTime);

  const idempotencyKey = resolveIdempotencyKey(parsed, req);
  if (idempotencyKey) {
    const existing = await findMeetingByIdempotencyKey(String(idempotencyKey));
    if (existing) return existing;
  }

  const payload = normalizeCreatePayload(parsed, user);
  assertVideoLinkWhenRequired({
    role: user.role,
    meetingType: payload.meetingType,
    status: payload.status,
    zoomJoinUrl: payload.zoomJoinUrl
  });

  await assertMentorStudentAccess({
    mentorUserId: payload.mentorUserId,
    studentUserId: payload.studentUserId
  });

  const role = user.role?.toUpperCase();
  let accessType = null;
  let sessionPackageId = null;

  if (isStudentMentorRequest(role, payload)) {
    const studentMeetings = await listMeetingsForUser({
      userId: payload.studentUserId || user.id,
      role: "STUDENT"
    });
    const access = await assertMentorRequestAccess({
      studentUserId: payload.studentUserId || user.id,
      mentorUserId: payload.mentorUserId || null,
      user,
      meetings: studentMeetings
    });

    if (canUsePrisma()) {
      try {
        return await prismaClient().$transaction(async (tx) => {
          const reserved = await reserveAccessForMeeting({
            access,
            studentUserId: payload.studentUserId || user.id,
            mentorUserId: payload.mentorUserId || null,
            tx
          });
          return createMeetingRecord(
            {
              ...payload,
              idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
              accessType: reserved.accessType,
              sessionPackageId: reserved.sessionPackageId
            },
            { tx }
          );
        });
      } catch (error) {
        if (error.statusCode || error.code === "NO_MENTOR_ACCESS") throw error;
        if (!isDatabaseUnavailableError(error)) throw error;
      }
    }

    const reserved = await reserveAccessForMeeting({
      access,
      studentUserId: payload.studentUserId || user.id,
      mentorUserId: payload.mentorUserId || null
    });
    accessType = reserved.accessType;
    sessionPackageId = reserved.sessionPackageId;
  }

  try {
    return await createMeetingRecord({
      ...payload,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : null,
      accessType,
      sessionPackageId
    });
  } catch (error) {
    if (sessionPackageId) {
      await releasePackageSession({ packageId: sessionPackageId }).catch(() => {});
    }
    throw error;
  }
}

export async function updateScheduledMeeting(id, body, user) {
  const parsed = updateMeetingSchema.parse(body);
  const existing = await getMeetingById(id);
  if (!existing) {
    throw userFacingError("Meeting not found.", 404, "not_found");
  }
  if (!canUserAccessMeeting(user, existing)) {
    throw userFacingError("You do not have permission to update this meeting.", 403, "forbidden");
  }

  const role = user.role?.toUpperCase();
  if (role === "STUDENT" && parsed.status && parsed.status !== "pending" && parsed.status !== "canceled") {
    throw userFacingError("Students cannot approve meetings.", 403, "forbidden");
  }

  const nextStatus = parsed.status || existing.status;
  const nextMeetingType = parsed.meetingType || existing.meetingType;
  const nextStart = parsed.startTime || existing.startTime;
  const nextEnd = parsed.endTime || existing.endTime;
  const nextZoomJoinUrl = parsed.zoomJoinUrl !== undefined ? parsed.zoomJoinUrl?.trim() || null : existing.zoomJoinUrl;

  validateTimes(nextStart, nextEnd);

  const approving =
    (existing.status === "pending" || existing.status === "declined") &&
    (nextStatus === "scheduled" || nextStatus === "approved");

  if (approving && isVideoMeetingType(nextMeetingType)) {
    assertVideoLinkWhenRequired({
      role: user.role,
      meetingType: nextMeetingType,
      status: nextStatus,
      zoomJoinUrl: nextZoomJoinUrl
    });
  }

  const releasingPackage =
    existing.accessType === "session_package" &&
    existing.sessionPackageId &&
    shouldReleasePackageOnStatus(nextStatus) &&
    !shouldReleasePackageOnStatus(existing.status);

  let meeting = await updateMeetingRecord(id, {
    ...parsed,
    status: nextStatus,
    zoomJoinUrl: parsed.zoomJoinUrl !== undefined ? nextZoomJoinUrl : undefined
  });

  if (releasingPackage) {
    await releasePackageSession({ packageId: existing.sessionPackageId });
  }

  if (!isVideoMeetingType(nextMeetingType)) {
    meeting = await updateMeetingRecord(id, {
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomHostUrl: null,
      zoomPassword: null
    });
  }

  return meeting;
}

export {
  createMeetingSchema,
  updateMeetingSchema,
  isValidZoomJoinUrl,
  isValidGoogleMeetJoinUrl,
  isValidMeetingJoinUrl,
  canRequestMentor
};
