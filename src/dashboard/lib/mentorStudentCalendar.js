export function resolveMentorCalendarItemType(item = {}) {
  const category = String(item.category || "").toLowerCase();
  const formVariant = item.formVariant || item.calendarItemType;

  if (formVariant === "task" || category === "personal_task") return "task";
  if (category.includes("deadline")) return "deadline";
  if (category === "mentor_meeting" || item.meetingType) return "meeting";
  if (item.reminderMinutes != null && !category.includes("deadline")) return "reminder";
  if (category.includes("note")) return "note";
  return formVariant === "event" ? "meeting" : "event";
}

export function enrichMentorStudentCalendarItem(item, student) {
  if (!student?.id) return item;

  const sharedWithStudent = item.shared !== false;

  return {
    ...item,
    studentId: student.id,
    studentName: student.name,
    createdByRole: "mentor",
    itemType: resolveMentorCalendarItemType(item),
    shared: sharedWithStudent,
    sharedWithStudent,
    mentorCreated: true,
    mentorOnly: false
  };
}
