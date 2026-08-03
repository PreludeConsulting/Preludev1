import {
  adminRest,
  first,
  httpError,
  json,
  readJsonBody,
  resolveCallerRole,
  rest,
  runAuthenticated
} from "./http.js";
import {
  listBookableDates,
  normalizeAvailabilitySchedule,
  validateMentorBookingSlot
} from "../../shared/mentorBookingSlots.js";

const MEETING_TYPES = new Set(["zoom", "google_meet", "in_person", "phone"]);
const MEETING_STATUSES = new Set(["scheduled", "pending", "approved", "declined", "canceled", "rescheduled"]);
const STUDENT_UPDATE_STATUSES = new Set(["pending", "canceled"]);
const MENTOR_UPDATE_STATUSES = new Set(["scheduled", "pending", "approved", "declined", "canceled", "rescheduled"]);

function isVideoMeetingType(meetingType) {
  return meetingType === "zoom" || meetingType === "google_meet";
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

function isValidMeetingJoinUrl(url, meetingType) {
  if (meetingType === "google_meet") return isValidGoogleMeetJoinUrl(url);
  if (meetingType === "zoom") return isValidZoomJoinUrl(url);
  return isValidZoomJoinUrl(url) || isValidGoogleMeetJoinUrl(url);
}

function validateTimes(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw httpError("Meeting time is invalid.", 422, "validation_error");
  }
  if (end <= start) throw httpError("Meeting end time must be after the start time.", 422, "validation_error");
  if (start.getTime() < Date.now() - 5 * 60 * 1000) {
    throw httpError("Meeting must be scheduled in the future.", 422, "validation_error");
  }
  if (start.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
    throw httpError("Meeting is too far in the future.", 422, "validation_error");
  }
}

function rowToMeeting(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    studentId: row.student_slug ?? null,
    mentorId: row.mentor_slug ?? null,
    studentUserId: row.student_user_id ?? null,
    mentorUserId: row.mentor_user_id ?? null,
    meetingType: row.meeting_type || "zoom",
    startTime: row.start_time,
    endTime: row.end_time,
    timeZone: row.time_zone || "America/New_York",
    zoomMeetingId: row.zoom_meeting_id ?? null,
    zoomJoinUrl: row.zoom_join_url ?? null,
    zoomHostUrl: row.zoom_host_url ?? null,
    zoomPassword: row.zoom_password ?? null,
    status: row.status || "pending",
    notes: row.notes || "",
    isPrivate: Boolean(row.is_private),
    idempotencyKey: row.idempotency_key ?? null,
    accessType: row.access_type ?? null,
    sessionPackageId: row.session_package_id ?? null,
    subscriptionSessionPeriodId: row.subscription_session_period_id ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

export function sanitizeMeetingForRole(meeting, role) {
  if (!meeting) return null;
  const copy = { ...meeting };
  if (String(role || "").toUpperCase() !== "MENTOR") {
    delete copy.zoomHostUrl;
    delete copy.zoomPassword;
  }
  return copy;
}

function canUserAccessMeeting(userId, role, meeting) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return true;
  if (r === "MENTOR") return meeting.mentorUserId === userId;
  if (r === "STUDENT") return meeting.studentUserId === userId && !meeting.isPrivate;
  return false;
}

function resolveIdempotencyKey(body, request) {
  return (
    body.idempotencyKey ||
    body.clientRequestId ||
    request.headers.get("Idempotency-Key") ||
    request.headers.get("X-Idempotency-Key") ||
    null
  );
}

async function assertActiveMatch(context, token, studentUserId, mentorUserId) {
  if (!studentUserId || !mentorUserId) return;
  const rows = await rest(
    context,
    token,
    `mentor_matches?select=id&student_id=eq.${encodeURIComponent(studentUserId)}&mentor_id=eq.${encodeURIComponent(mentorUserId)}&status=in.(assigned,pending,saved)&limit=1`
  );
  if (!first(rows)) {
    throw httpError("You do not have permission to schedule with this student.", 403, "forbidden");
  }
}

export async function loadMeetingsForUser(context, token, userId, role) {
  const r = String(role || "").toUpperCase();
  const filter =
    r === "MENTOR"
      ? `mentor_user_id=eq.${encodeURIComponent(userId)}&status=neq.canceled`
      : `student_user_id=eq.${encodeURIComponent(userId)}&is_private=eq.false&status=neq.canceled`;
  const rows = await rest(
    context,
    token,
    `meetings?select=*&${filter}&order=start_time.asc`
  );
  return (rows || []).map(rowToMeeting);
}

async function findByIdempotencyKey(context, token, key) {
  if (!key) return null;
  const rows = await rest(
    context,
    token,
    `meetings?select=*&idempotency_key=eq.${encodeURIComponent(key)}&limit=1`
  );
  return rowToMeeting(first(rows));
}

async function getMeetingById(context, token, id) {
  const rows = await rest(context, token, `meetings?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rowToMeeting(first(rows));
}

async function loadMentorSchedule(context, _token, mentorUserId) {
  // Service-role read so assigned students always see the same schedule the mentor saved,
  // even when the mentor profile is not yet publicly approved for network browsing.
  const rows = await adminRest(
    context,
    `mentor_matching_profiles?select=availability_schedule&mentor_user_id=eq.${encodeURIComponent(mentorUserId)}&limit=1`
  );
  return normalizeAvailabilitySchedule(first(rows)?.availability_schedule || null);
}

async function loadMentorBusyMeetings(context, _token, mentorUserId) {
  const rows = await adminRest(
    context,
    `meetings?select=*&mentor_user_id=eq.${encodeURIComponent(mentorUserId)}&status=not.in.(canceled,declined)&order=start_time.asc`
  );
  return (rows || []).map(rowToMeeting);
}

function parseCreateBody(body, user, role) {
  const title = String(body.title || "").trim();
  if (!title || title.length > 180) throw httpError("Meeting title is required.", 422, "validation_error");
  const meetingType = body.meetingType || "zoom";
  if (!MEETING_TYPES.has(meetingType)) throw httpError("Invalid meeting type.", 422, "validation_error");
  validateTimes(body.startTime, body.endTime);

  let status = body.status || (role === "student" ? "pending" : "scheduled");
  if (!MEETING_STATUSES.has(status)) throw httpError("Invalid meeting status.", 422, "validation_error");

  const studentUserId = body.studentUserId || (role === "student" ? user.id : null);
  const mentorUserId = body.mentorUserId || (role === "mentor" ? user.id : null);

  if (role === "student" && studentUserId !== user.id) {
    throw httpError("You cannot schedule a meeting for another student.", 403, "forbidden");
  }
  if (role === "mentor" && mentorUserId !== user.id) {
    throw httpError("You cannot schedule a meeting as another mentor.", 403, "forbidden");
  }
  if (role === "student" && status === "scheduled" && isVideoMeetingType(meetingType)) {
    status = "pending";
  }
  if (role === "student" && status !== "pending") {
    throw httpError("Students may only create pending meeting requests.", 403, "forbidden");
  }

  let zoomJoinUrl = typeof body.zoomJoinUrl === "string" ? body.zoomJoinUrl.trim() : null;
  if (role === "student") zoomJoinUrl = null;
  if (
    isVideoMeetingType(meetingType) &&
    (status === "scheduled" || status === "approved") &&
    role !== "student" &&
    !isValidMeetingJoinUrl(zoomJoinUrl, meetingType)
  ) {
    throw httpError("Paste a valid meeting link before approving or scheduling.", 422, "validation_error");
  }

  return {
    title,
    meetingType,
    startTime: body.startTime,
    endTime: body.endTime,
    timeZone: body.timeZone || "America/New_York",
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : "",
    status,
    studentUserId,
    mentorUserId,
    studentId: body.studentId || null,
    mentorId: body.mentorId || null,
    isPrivate: Boolean(body.isPrivate),
    zoomJoinUrl
  };
}

export async function handleMeetings(context, action = "index") {
  return runAuthenticated(context, async ({ user, token }) => {
    const role = await resolveCallerRole(context, user, token);
    const method = context.request.method;

    if (action === "available-slots") {
      if (method !== "GET") return json({ error: "method_not_allowed" }, 405);
      const url = new URL(context.request.url);
      const mentorUserId = url.searchParams.get("mentorUserId") || url.searchParams.get("mentorId");
      if (!mentorUserId) {
        return json({ error: "validation_error", message: "mentorUserId is required." }, 400);
      }
      const schedule = await loadMentorSchedule(context, token, mentorUserId);
      const meetings = await loadMentorBusyMeetings(context, token, mentorUserId);
      const dates = listBookableDates({ schedule, meetings, now: new Date() });
      return json({
        mentorUserId,
        timezone: schedule.timezone,
        schedule,
        dates: dates.map((day) => ({
          date: day.date,
          weekday: day.weekday,
          label: day.label,
          hasAvailability: day.hasAvailability,
          slots: day.slots.map((slot) => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            label: slot.label,
            startIso: slot.startIso,
            endIso: slot.endIso,
            available: slot.available,
            taken: slot.taken
          }))
        }))
      });
    }

    if (action === "index" && method === "GET") {
      const meetings = (await loadMeetingsForUser(context, token, user.id, role)).map((m) =>
        sanitizeMeetingForRole(m, role)
      );
      return json({ meetings });
    }

    if (action === "index" && method === "POST") {
      const body = await readJsonBody(context.request);
      const idempotencyKey = resolveIdempotencyKey(body, context.request);
      if (idempotencyKey) {
        const existing = await findByIdempotencyKey(context, token, String(idempotencyKey));
        if (existing) {
          if (!canUserAccessMeeting(user.id, role, existing)) {
            throw httpError("You do not have permission to access this meeting.", 403, "forbidden");
          }
          return json({ meeting: sanitizeMeetingForRole(existing, role) }, 200);
        }
      }

      const payload = parseCreateBody(body, user, role);
      await assertActiveMatch(context, token, payload.studentUserId, payload.mentorUserId);

      if (role === "student" && isVideoMeetingType(payload.meetingType) && payload.mentorUserId) {
        const schedule = await loadMentorSchedule(context, token, payload.mentorUserId);
        const meetings = await loadMentorBusyMeetings(context, token, payload.mentorUserId);
        const slotCheck = validateMentorBookingSlot({
          startTime: payload.startTime,
          endTime: payload.endTime,
          schedule,
          meetings
        });
        if (!slotCheck.ok) {
          throw httpError(slotCheck.message || "That time slot is unavailable.", 409, slotCheck.code || "slot_unavailable");
        }
      }

      const insert = {
        title: payload.title,
        student_user_id: payload.studentUserId,
        mentor_user_id: payload.mentorUserId,
        student_slug: payload.studentId,
        mentor_slug: payload.mentorId,
        meeting_type: payload.meetingType,
        start_time: payload.startTime,
        end_time: payload.endTime,
        time_zone: payload.timeZone,
        zoom_join_url: payload.zoomJoinUrl,
        status: payload.status,
        notes: payload.notes,
        is_private: payload.isPrivate,
        idempotency_key: idempotencyKey ? String(idempotencyKey) : null
      };

      const rows = await rest(context, token, "meetings", {
        method: "POST",
        body: JSON.stringify(insert)
      });
      const meeting = rowToMeeting(first(rows));
      return json({ meeting: sanitizeMeetingForRole(meeting, role) }, 201);
    }

    if (action === "by-id" && method === "PATCH") {
      const meetingId = context.params?.id;
      if (!meetingId || meetingId === "available-slots") {
        return json({ error: "not_found", message: "Meeting not found." }, 404);
      }
      const existing = await getMeetingById(context, token, meetingId);
      if (!existing || !canUserAccessMeeting(user.id, role, existing)) {
        throw httpError("Meeting not found.", 404, "not_found");
      }

      const body = await readJsonBody(context.request);
      const patch = {};
      if (body.title !== undefined) {
        const title = String(body.title || "").trim();
        if (!title || title.length > 180) throw httpError("Meeting title is invalid.", 422, "validation_error");
        patch.title = title;
      }
      if (body.notes !== undefined) patch.notes = String(body.notes || "").trim().slice(0, 4000);
      if (body.meetingType !== undefined) {
        if (!MEETING_TYPES.has(body.meetingType)) throw httpError("Invalid meeting type.", 422, "validation_error");
        patch.meeting_type = body.meetingType;
      }
      if (body.timeZone !== undefined) patch.time_zone = String(body.timeZone || "").trim().slice(0, 64);
      if (body.startTime !== undefined || body.endTime !== undefined) {
        const startTime = body.startTime || existing.startTime;
        const endTime = body.endTime || existing.endTime;
        validateTimes(startTime, endTime);
        patch.start_time = startTime;
        patch.end_time = endTime;
      }
      if (body.isPrivate !== undefined) patch.is_private = Boolean(body.isPrivate);

      let nextStatus = body.status !== undefined ? body.status : existing.status;
      if (body.status !== undefined) {
        if (!MEETING_STATUSES.has(body.status)) throw httpError("Invalid meeting status.", 422, "validation_error");
        if (role === "student" && !STUDENT_UPDATE_STATUSES.has(body.status)) {
          throw httpError("Students may only keep a meeting pending or cancel it.", 403, "forbidden");
        }
        if (role === "mentor" && !MENTOR_UPDATE_STATUSES.has(body.status)) {
          throw httpError("Invalid meeting status transition.", 403, "forbidden");
        }
        patch.status = body.status;
        nextStatus = body.status;
      }

      if (body.zoomJoinUrl !== undefined) {
        if (role === "student") throw httpError("Students cannot attach meeting credentials.", 403, "forbidden");
        const meetingType = patch.meeting_type || existing.meetingType;
        const zoomJoinUrl = String(body.zoomJoinUrl || "").trim();
        if (
          isVideoMeetingType(meetingType) &&
          (nextStatus === "scheduled" || nextStatus === "approved") &&
          !isValidMeetingJoinUrl(zoomJoinUrl, meetingType)
        ) {
          throw httpError("Paste a valid meeting link before approving or scheduling.", 422, "validation_error");
        }
        patch.zoom_join_url = zoomJoinUrl || null;
      }

      if (role === "student") {
        patch.zoom_host_url = null;
        patch.zoom_password = null;
      }

      const rows = await rest(context, token, `meetings?id=eq.${encodeURIComponent(meetingId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      const meeting = rowToMeeting(first(rows));
      if (!meeting) throw httpError("Meeting could not be updated.", 409, "conflict");
      return json({ meeting: sanitizeMeetingForRole(meeting, role) });
    }

    return json({ error: "method_not_allowed" }, 405);
  });
}
