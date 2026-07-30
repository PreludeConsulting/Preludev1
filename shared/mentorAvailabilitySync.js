/**
 * Shared availability summary + student-facing match sync helpers.
 */

export function formatAvailabilitySummary(availability) {
  const timezone = availability?.timezone || "ET";
  const enabledDays = (availability?.days || []).filter((day) => day.enabled);
  if (!enabledDays.length) return "";

  function toLabel(time) {
    const [hourRaw, minuteRaw] = String(time || "00:00").split(":").map(Number);
    const period = hourRaw >= 12 ? "PM" : "AM";
    let hour = hourRaw % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${String(minuteRaw || 0).padStart(2, "0")} ${period}`;
  }

  return enabledDays
    .map((day) => `${String(day.dayOfWeek || "").slice(0, 3)} ${toLabel(day.startTime)} – ${toLabel(day.endTime)}`)
    .join(" · ")
    .concat(` ${timezone}`);
}

/**
 * Keep student Book a Session / mentor cards in sync when a mentor saves hours.
 * Updates mentor_matches.availability text for every match row pointing at this mentor.
 */
export async function syncMentorAvailabilityToStudentMatches(supabase, mentorUserId, availabilitySummary) {
  if (!supabase || !mentorUserId) return;
  const summary = String(availabilitySummary || "").trim();
  const { error } = await supabase
    .from("mentor_matches")
    .update({
      availability: summary,
      updated_at: new Date().toISOString()
    })
    .eq("mentor_id", mentorUserId);
  if (error) {
    console.error("[prelude-availability] mentor_matches sync failed", error.message || error);
  }
}
