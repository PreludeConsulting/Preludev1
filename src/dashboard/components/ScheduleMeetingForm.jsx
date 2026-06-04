import { useState } from "react";

const MEETING_TYPES = [
  { value: "zoom", label: "Zoom Meeting" },
  { value: "in_person", label: "In-Person Meeting" },
  { value: "phone", label: "Phone Call" }
];

export default function ScheduleMeetingForm({ onSubmit, defaultStudentId, compact }) {
  const [form, setForm] = useState({
    title: "Mentor check-in",
    meetingType: "zoom",
    startTime: "",
    endTime: "",
    notes: "",
    studentId: defaultStudentId || "student-demo-1",
    status: "scheduled"
  });

  function update(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const start = new Date(form.startTime).toISOString();
    const end = new Date(form.endTime || form.startTime).toISOString();
    onSubmit?.({
      title: form.title,
      meetingType: form.meetingType,
      startTime: start,
      endTime: end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      studentId: form.studentId,
      mentorId: "mentor-demo-1",
      notes: form.notes,
      status: form.status,
      isPrivate: false
    });
  }

  return (
    <form className={`dash-schedule-form paper-card ${compact ? "dash-schedule-form--compact" : ""}`} onSubmit={handleSubmit}>
      <h3 className="dash-schedule-form__title">Schedule meeting</h3>
      <label className="prelude-field">
        <span>Title</span>
        <input value={form.title} onChange={update("title")} required />
      </label>
      <label className="prelude-field">
        <span>Meeting type</span>
        <select value={form.meetingType} onChange={update("meetingType")}>
          {MEETING_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <label className="prelude-field">
        <span>Start</span>
        <input type="datetime-local" value={form.startTime} onChange={update("startTime")} required />
      </label>
      <label className="prelude-field">
        <span>End</span>
        <input type="datetime-local" value={form.endTime} onChange={update("endTime")} required />
      </label>
      <label className="prelude-field">
        <span>Notes</span>
        <textarea rows={2} value={form.notes} onChange={update("notes")} />
      </label>
      <button type="submit" className="dash-btn-primary">Create meeting</button>
    </form>
  );
}
