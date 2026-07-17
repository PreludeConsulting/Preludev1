import { getSupabaseAdmin } from "./supabaseRequestAuth.js";
import { listMeetingsForMentor } from "./meetingStore.js";
import {
  listBookableDates,
  normalizeAvailabilitySchedule,
  validateMentorBookingSlot
} from "../../shared/mentorBookingSlots.js";

function userFacingError(message, statusCode = 400, code = "validation_error") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function loadMentorAvailabilitySchedule(mentorUserId) {
  if (!mentorUserId) return normalizeAvailabilitySchedule(null);

  // Test / local override map: globalThis.__preludeMentorSchedules[mentorUserId]
  const override = globalThis.__preludeMentorSchedules?.[mentorUserId];
  if (override) return normalizeAvailabilitySchedule(override);

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { data, error } = await supabase
      .from("mentor_matching_profiles")
      .select("availability_schedule")
      .eq("mentor_user_id", mentorUserId)
      .maybeSingle();
    if (!error && data?.availability_schedule) {
      return normalizeAvailabilitySchedule(data.availability_schedule);
    }
  }

  // Demo / local fallback: leave empty so validation fails closed unless tests inject schedule.
  return normalizeAvailabilitySchedule(null);
}

export async function getMentorBusyMeetings(mentorUserId) {
  if (!mentorUserId) return [];
  return listMeetingsForMentor(mentorUserId);
}

export async function getAvailableMentorSlots({
  mentorUserId,
  schedule = null,
  now = new Date(),
  windowDays
} = {}) {
  const availability = schedule || (await loadMentorAvailabilitySchedule(mentorUserId));
  const meetings = await getMentorBusyMeetings(mentorUserId);
  return {
    schedule: availability,
    meetings,
    dates: listBookableDates({ schedule: availability, meetings, now, windowDays })
  };
}

/**
 * Enforce 1-hour duration + mentor availability + no double-booking for student video requests.
 */
export async function assertMentorSlotBookable({
  mentorUserId,
  startTime,
  endTime,
  schedule = null,
  excludeMeetingId = null
} = {}) {
  if (!mentorUserId) {
    throw userFacingError(
      "Select a mentor before requesting a session.",
      400,
      "mentor_required"
    );
  }

  const availability = schedule || (await loadMentorAvailabilitySchedule(mentorUserId));
  if (!availability.days?.some((day) => day.enabled)) {
    throw userFacingError(
      "Your mentor has not set availability yet. Please try again later.",
      409,
      "availability_missing"
    );
  }

  let meetings = await getMentorBusyMeetings(mentorUserId);
  if (excludeMeetingId) {
    meetings = meetings.filter((meeting) => meeting.id !== excludeMeetingId);
  }

  const result = validateMentorBookingSlot({
    startTime,
    endTime,
    schedule: availability,
    meetings
  });

  if (!result.ok) {
    throw userFacingError(result.message, 409, result.code || "slot_unavailable");
  }

  return { schedule: availability, meetings };
}
