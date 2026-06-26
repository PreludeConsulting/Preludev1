import { z } from "zod";
import { db } from "../authApi.js";
import {
  createMeetingRecord,
  findMeetingByIdempotencyKey,
  getMeetingById,
  shouldAttachZoom,
  updateMeetingRecord
} from "./meetingStore.js";
import { createZoomMeeting, deleteZoomMeeting, isZoomConfigured } from "./zoomService.js";

const meetingTypeSchema = z.enum(["zoom", "in_person", "phone"]);
const meetingStatusSchema = z.enum(["scheduled", "pending", "approved", "declined", "canceled", "rescheduled"]);

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
  explicitZoom: z.boolean().optional(),
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
  isPrivate: z.boolean().optional()
});

function userFacingError(message, statusCode = 400, code = "validation_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
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
    // Demo/offline environments may not have assignments seeded.
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

function shouldCreateZoomNow({ meetingType, status, isPrivate, explicitZoom, existingJoinUrl }) {
  if (existingJoinUrl) return false;
  if (!shouldAttachZoom(meetingType, isPrivate, explicitZoom)) return false;
  return status === "scheduled" || status === "approved";
}

async function attachZoomToMeeting(meeting) {
  if (!isZoomConfigured()) {
    throw userFacingError(
      "Video meetings are temporarily unavailable. Please try again later or contact support.",
      503,
      "zoom_not_configured"
    );
  }

  const zoom = await createZoomMeeting({
    topic: meeting.title,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    timezone: meeting.timeZone,
    agenda: meeting.notes || undefined
  });

  try {
    return await updateMeetingRecord(meeting.id, {
      zoomMeetingId: zoom.zoomMeetingId,
      zoomJoinUrl: zoom.joinUrl,
      zoomHostUrl: zoom.startUrl,
      zoomPassword: zoom.password
    });
  } catch (error) {
    await deleteZoomMeeting(zoom.zoomMeetingId);
    throw error;
  }
}

function normalizeCreatePayload(body, user) {
  const role = user.role?.toUpperCase();
  const payload = {
    ...body,
    studentUserId: body.studentUserId || (role === "STUDENT" ? user.id : undefined),
    mentorUserId: body.mentorUserId || (role === "MENTOR" ? user.id : undefined),
    status: body.status || (role === "STUDENT" ? "pending" : "scheduled")
  };

  if (role === "STUDENT" && payload.status === "scheduled" && payload.meetingType === "zoom") {
    payload.status = "pending";
  }

  return payload;
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
  await assertMentorStudentAccess({
    mentorUserId: payload.mentorUserId,
    studentUserId: payload.studentUserId
  });

  let meeting = await createMeetingRecord({
    ...payload,
    idempotencyKey: idempotencyKey ? String(idempotencyKey) : null
  });

  if (shouldCreateZoomNow(meeting)) {
    meeting = await attachZoomToMeeting(meeting);
  }

  return meeting;
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
  validateTimes(nextStart, nextEnd);

  let meeting = await updateMeetingRecord(id, {
    ...parsed,
    status: nextStatus
  });

  const approving =
    (existing.status === "pending" || existing.status === "declined") &&
    (nextStatus === "scheduled" || nextStatus === "approved");

  if (
    shouldCreateZoomNow({
      meetingType: nextMeetingType,
      status: nextStatus,
      isPrivate: meeting.isPrivate,
      explicitZoom: false,
      existingJoinUrl: meeting.zoomJoinUrl
    }) &&
    (approving || !existing.zoomJoinUrl)
  ) {
    meeting = await attachZoomToMeeting(meeting);
  }

  if (nextMeetingType !== "zoom") {
    meeting = await updateMeetingRecord(id, {
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomHostUrl: null,
      zoomPassword: null
    });
  }

  return meeting;
}

export { createMeetingSchema, updateMeetingSchema };
