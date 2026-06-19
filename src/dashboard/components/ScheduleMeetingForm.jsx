import { useRef, useState } from "react";
import { MaskedDateInput, MaskedTimeInput } from "./MaskedInputs.jsx";
import { isScheduleFormValid } from "../lib/scheduleFormValidation.js";

function addHoursToTime(time24, hours = 1) {
  if (!time24 || time24.length < 5) return "";
  const [h, m] = time24.split(":").map((part) => parseInt(part, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const totalMinutes = h * 60 + m + hours * 60;
  const nextHour = Math.floor(totalMinutes / 60) % 24;
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

const MEETING_TYPES = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" }
];

function createDefaultForm(defaultStudentId) {
  return {
    title: "Mentor check-in",
    meetingType: "zoom",
    date: "",
    startTime: "",
    endTime: "",
    notes: "",
    studentId: defaultStudentId || "student-demo-1",
    status: "scheduled"
  };
}

const REQUIRED_FIELDS_MESSAGE = "Please fill out all required fields (title, date, start time, and end time).";

export default function ScheduleMeetingForm({ onSubmit, defaultStudentId, compact, wide, requestMode = false }) {
  const [form, setForm] = useState(() => createDefaultForm(defaultStudentId));
  const [requestSent, setRequestSent] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const endTimeManuallyEdited = useRef(false);

  function applyFormUpdate(updater) {
    setForm((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (isScheduleFormValid(next)) {
        setFormError("");
      }
      return next;
    });
  }

  function update(key) {
    return (value) => {
      applyFormUpdate((current) => ({ ...current, [key]: value }));
    };
  }

  function updateText(key) {
    return (e) => {
      applyFormUpdate((current) => ({ ...current, [key]: e.target.value }));
    };
  }

  function resetForm() {
    setForm(createDefaultForm(defaultStudentId));
    setFormError("");
    endTimeManuallyEdited.current = false;
  }

  function handleStartTimeChange(startTime) {
    applyFormUpdate((current) => {
      const next = { ...current, startTime };
      if (!endTimeManuallyEdited.current && startTime?.length >= 5) {
        next.endTime = addHoursToTime(startTime, 1);
      }
      return next;
    });
  }

  function handleEndTimeChange(endTime) {
    endTimeManuallyEdited.current = true;
    applyFormUpdate((current) => ({ ...current, endTime }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const snapshot = {
      title: form.title.trim(),
      date: form.date.trim(),
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      meetingType: form.meetingType,
      notes: form.notes,
      studentId: form.studentId,
      status: form.status
    };

    if (!isScheduleFormValid(snapshot)) {
      setFormError(REQUIRED_FIELDS_MESSAGE);
      return;
    }

    const start = new Date(`${snapshot.date}T${snapshot.startTime}`).toISOString();
    const end = new Date(`${snapshot.date}T${snapshot.endTime}`).toISOString();
    const payload = {
      title: snapshot.title,
      meetingType: snapshot.meetingType,
      startTime: start,
      endTime: end,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      studentId: snapshot.studentId,
      mentorId: "mentor-demo-1",
      notes: snapshot.notes,
      status: requestMode ? "pending" : snapshot.status,
      isPrivate: false
    };

    setSubmitting(true);
    try {
      await onSubmit?.(payload);
      if (requestMode) {
        setRequestSent(true);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className={`dash-schedule-form paper-card ${compact ? "dash-schedule-form--compact" : ""} ${wide ? "dash-schedule-form--wide" : ""}`}
      onSubmit={handleSubmit}
    >
      <h3 className="dash-schedule-form__title">Schedule meeting</h3>
      <div className="dash-schedule-form__row">
        <label className="prelude-field">
          <span>Title</span>
          <input value={form.title} onChange={updateText("title")} />
        </label>
        <label className="prelude-field">
          <span>Meeting type</span>
          <select value={form.meetingType} onChange={updateText("meetingType")}>
            {MEETING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="prelude-field">
        <span>Date</span>
        <MaskedDateInput value={form.date} onChange={update("date")} />
      </label>
      <div className="dash-event-form__row">
        <label className="prelude-field">
          <span>Start time</span>
          <MaskedTimeInput value={form.startTime} onChange={handleStartTimeChange} />
        </label>
        <label className="prelude-field">
          <span>End time</span>
          <MaskedTimeInput value={form.endTime} onChange={handleEndTimeChange} />
        </label>
      </div>
      <label className="prelude-field dash-schedule-form__notes">
        <span>Notes</span>
        <textarea rows={3} value={form.notes} onChange={updateText("notes")} placeholder="Add any context for your mentor…" />
      </label>
      <button type="submit" className="dash-btn-primary" disabled={submitting}>
        Create meeting
      </button>
      {formError ? (
        <p className="dash-schedule-form__form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {requestMode && requestSent ? (
        <p className="dash-schedule-form__request-sent" role="status">
          A request has been made to your mentor!
        </p>
      ) : null}
    </form>
  );
}
