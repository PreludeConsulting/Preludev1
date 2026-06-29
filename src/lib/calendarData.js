/**
 * Supabase calendar event helpers.
 */

import { getSupabase } from "./supabase.js";
import { inferMeetingTypeFromUrl } from "./zoomMeetingLinks.js";

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

export function mapCalendarEvent(row) {
  const isUserCreated = row.event_type === "personal" || row.event_type === "session";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start: row.start_time,
    end: row.end_time,
    startTime: row.start_time,
    endTime: row.end_time,
    eventType: row.event_type,
    location: row.location,
    meetingType: row.meeting_url ? inferMeetingTypeFromUrl(row.meeting_url) || "zoom" : row.location ? "in_person" : "zoom",
    zoomJoinUrl: row.meeting_url,
    status: row.status,
    category: row.event_type === "personal" ? "personal_task" : "mentor_meeting",
    formVariant: row.event_type === "personal" ? "task" : isUserCreated ? "event" : undefined,
    calendarItemType: row.event_type === "personal" ? "task" : isUserCreated ? "event" : undefined,
    userCreated: isUserCreated,
    pillColor: isUserCreated ? "blue" : undefined
  };
}

export async function getMyCalendarEvents(userId) {
  if (!userId) return { events: [], error: "You must be signed in." };
  const { data, error } = await db()
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: true });
  return { events: (data || []).map(mapCalendarEvent), error: error?.message || null };
}

export async function createCalendarEvent(userId, event) {
  if (!userId) return { event: null, error: "You must be signed in." };
  const { data, error } = await db()
    .from("calendar_events")
    .insert({
      user_id: userId,
      title: event.title,
      description: event.description || null,
      start_time: event.startTime || event.start,
      end_time: event.endTime || event.end || null,
      event_type: event.eventType || "meeting",
      location: event.location || null,
      meeting_url: event.meetingUrl || event.zoomJoinUrl || null,
      status: event.status || "scheduled"
    })
    .select()
    .single();
  return { event: data ? mapCalendarEvent(data) : null, error: error?.message || null };
}

export async function updateCalendarEvent(userId, eventId, event) {
  if (!userId) return { event: null, error: "You must be signed in." };
  const payload = {};
  if (event.title !== undefined) payload.title = event.title;
  if (event.description !== undefined) payload.description = event.description;
  if (event.startTime !== undefined) payload.start_time = event.startTime;
  if (event.start !== undefined) payload.start_time = event.start;
  if (event.endTime !== undefined) payload.end_time = event.endTime;
  if (event.end !== undefined) payload.end_time = event.end;
  if (event.eventType !== undefined) payload.event_type = event.eventType;
  if (event.location !== undefined) payload.location = event.location;
  if (event.meetingUrl !== undefined) payload.meeting_url = event.meetingUrl;
  if (event.zoomJoinUrl !== undefined) payload.meeting_url = event.zoomJoinUrl;
  if (event.status !== undefined) payload.status = event.status;

  const { data, error } = await db()
    .from("calendar_events")
    .update(payload)
    .eq("id", eventId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  return { event: data ? mapCalendarEvent(data) : null, error: error?.message || null };
}

export async function deleteCalendarEvent(userId, eventId) {
  if (!userId) return { error: "You must be signed in." };
  const { error } = await db().from("calendar_events").delete().eq("id", eventId).eq("user_id", userId);
  return { error: error?.message || null };
}
