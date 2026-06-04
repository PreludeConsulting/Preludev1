import { useState } from "react";
import { Video, X } from "lucide-react";
import { EVENT_CATEGORY_LABELS } from "../data/placeholders.js";
import { IconButton, Modal, PrimaryButton, SecondaryButton } from "./ui/index.jsx";

const CATEGORIES = [
  { value: "mentor_meeting", label: "Mentor Meeting" },
  { value: "essay_deadline", label: "Essay Deadline" },
  { value: "application_deadline", label: "Application Deadline" },
  { value: "scholarship_deadline", label: "Scholarship Deadline" },
  { value: "personal_task", label: "Personal Task" },
  { value: "mentor_availability", label: "Mentor Availability" },
  { value: "mentor_private", label: "Mentor-Only Private Event" }
];

export function CalendarEventDetailModal({ event, role, mentorName, studentName, students = [], onClose, onEdit, onDelete }) {
  if (!event) return null;

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : start;
  const isMeeting = event.extendedProps?.meeting || event.category === "mentor_meeting";
  const meeting = event.extendedProps?.meeting;
  const zoomJoin = event.extendedProps?.zoomJoinUrl || meeting?.zoomJoinUrl;
  const zoomHost = meeting?.zoomHostUrl;
  const isPrivate = event.extendedProps?.mentorOnly || event.category === "mentor_private";
  const canEdit = role === "mentor" || !isPrivate;
  const canDelete = role === "mentor" || (event.category === "personal_task" && role === "student");

  return (
    <Modal
      open
      onClose={onClose}
      title={event.title}
      footer={
        <>
          {zoomJoin && event.extendedProps?.meetingType !== "in_person" ? (
            <a href={zoomJoin} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--primary">
              <Video className="h-4 w-4" /> Join Zoom Meeting
            </a>
          ) : null}
          {canEdit ? <SecondaryButton type="button" onClick={() => onEdit?.(event)}>Edit</SecondaryButton> : null}
          {canDelete ? (
            <button type="button" className="dash-btn dash-btn--danger" onClick={() => onDelete?.(event)}>
              Delete
            </button>
          ) : null}
          <SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>
        </>
      }
    >
      <dl className="dash-detail-list dash-detail-list--grid">
        <div>
          <dt>Category</dt>
          <dd>
            {EVENT_CATEGORY_LABELS[event.extendedProps?.category || event.category] || event.category}
            {isPrivate ? <span className="dash-badge dash-badge--urgent" style={{ marginLeft: "0.5rem" }}>Private · mentor only</span> : null}
          </dd>
        </div>
        <div><dt>Date</dt><dd>{start.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</dd></div>
        <div><dt>Start</dt><dd>{start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</dd></div>
        <div><dt>End</dt><dd>{end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</dd></div>
        {event.extendedProps?.description ? <div><dt>Description</dt><dd>{event.extendedProps.description}</dd></div> : null}
        {studentName ? <div><dt>Student</dt><dd>{studentName}</dd></div> : null}
        {mentorName ? <div><dt>Mentor</dt><dd>{mentorName}</dd></div> : null}
        {isMeeting ? <div><dt>Meeting type</dt><dd>{meeting?.meetingType || "zoom"}</dd></div> : null}
        {role === "mentor" && zoomHost ? (
          <div>
            <dt>Host link</dt>
            <dd><a href={zoomHost} target="_blank" rel="noopener noreferrer" className="dash-view-all">Zoom host URL (mentor only)</a></dd>
          </div>
        ) : null}
      </dl>
    </Modal>
  );
}

export function CalendarAddEventModal({ open, onClose, role, students = [], onSave }) {
  const [form, setForm] = useState({
    title: "",
    category: "personal_task",
    date: "",
    startTime: "",
    endTime: "",
    description: "",
    meetingType: "zoom",
    studentId: "",
    shared: true,
    zoom: true
  });
  const [errors, setErrors] = useState({});

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.date) next.date = "Date is required.";
    if (!form.startTime) next.startTime = "Start time is required.";
    if (!form.endTime) next.endTime = "End time is required.";
    if (form.startTime && form.endTime && form.endTime <= form.startTime) next.endTime = "End must be after start.";
    if (role === "mentor" && form.category === "mentor_meeting" && !form.studentId) next.studentId = "Select a student.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const start = new Date(`${form.date}T${form.startTime}`);
    const end = new Date(`${form.date}T${form.endTime}`);
    onSave?.({
      id: `evt-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      start: start.toISOString(),
      end: end.toISOString(),
      description: form.description,
      studentId: form.studentId || undefined,
      shared: form.shared,
      mentorOnly: !form.shared && role === "mentor",
      meetingType: form.zoom ? "zoom" : "in_person",
      zoomJoinUrl: form.zoom && form.category === "mentor_meeting" ? "https://zoom.us/j/placeholder-new" : undefined
    });
    onClose();
    setForm({ title: "", category: "personal_task", date: "", startTime: "", endTime: "", description: "", meetingType: "zoom", studentId: "", shared: true, zoom: true });
    setErrors({});
  }

  if (!open) return null;

  return (
    <div className="dash-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="dash-modal dash-modal--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal__head">
          <h2 className="dash-modal__title">Add event</h2>
          <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        <form className="dash-modal__body dash-event-form" onSubmit={handleSubmit}>
          <label className="prelude-field">
            <span>Event title</span>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            {errors.title ? <em className="dash-field-error">{errors.title}</em> : null}
          </label>
          <label className="prelude-field">
            <span>Category</span>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.filter((c) => role === "mentor" || c.value !== "mentor_private").map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="prelude-field">
            <span>Date</span>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            {errors.date ? <em className="dash-field-error">{errors.date}</em> : null}
          </label>
          <div className="dash-event-form__row">
            <label className="prelude-field">
              <span>Start time</span>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              {errors.startTime ? <em className="dash-field-error">{errors.startTime}</em> : null}
            </label>
            <label className="prelude-field">
              <span>End time</span>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              {errors.endTime ? <em className="dash-field-error">{errors.endTime}</em> : null}
            </label>
          </div>
          <label className="prelude-field dash-form-full">
            <span>Description</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          {role === "mentor" ? (
            <>
              <label className="prelude-field">
                <span>Student (for meetings)</span>
                <select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
                  <option value="">—</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.studentId ? <em className="dash-field-error">{errors.studentId}</em> : null}
              </label>
              <label className="dash-check-label">
                <input type="checkbox" checked={form.shared} onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))} />
                Shared with student (uncheck for private mentor-only)
              </label>
            </>
          ) : null}
          <label className="prelude-field">
            <span>Meeting type</span>
            <select value={form.meetingType} onChange={(e) => setForm((f) => ({ ...f, meetingType: e.target.value }))}>
              <option value="zoom">Zoom</option>
              <option value="in_person">In person</option>
            </select>
          </label>
          <label className="dash-check-label">
            <input type="checkbox" checked={form.zoom} onChange={(e) => setForm((f) => ({ ...f, zoom: e.target.checked }))} />
            Create Zoom meeting link
          </label>
          <div className="dash-modal__footer dash-modal__footer--inline">
            <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
            <PrimaryButton type="submit">Save event</PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
