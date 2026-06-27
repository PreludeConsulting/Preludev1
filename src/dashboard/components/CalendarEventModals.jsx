import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Video, X } from "lucide-react";
import { isValidZoomJoinUrl, normalizeZoomJoinUrl } from "../../lib/zoomMeetingLinks.js";
import JoinZoomButton from "./JoinZoomButton.jsx";
import { cn } from "../../lib/utils.js";
import {
  getDefaultReminderMinutes,
  getNotificationPermission,
  REMINDER_OPTIONS
} from "../lib/calendarReminders.js";
import { EVENT_CATEGORY_LABELS } from "../data/placeholders.js";
import NotificationPermissionModal from "./NotificationPermissionModal.jsx";
import { MaskedDateInput, MaskedTimeInput } from "./MaskedInputs.jsx";
import { IconButton, Modal, PrimaryButton, SecondaryButton } from "./ui/index.jsx";

export const CALENDAR_COLOR_OPTIONS = [
  { value: "red", label: "Red" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "orange", label: "Orange" },
  { value: "purple", label: "Purple" }
];

const CATEGORIES = [
  { value: "mentor_meeting", label: "Mentor Meeting" },
  { value: "essay_deadline", label: "Essay Deadline" },
  { value: "application_deadline", label: "Application Deadline" },
  { value: "scholarship_deadline", label: "Scholarship Deadline" },
  { value: "personal_task", label: "Personal Task" },
  { value: "mentor_availability", label: "Mentor Availability" },
  { value: "mentor_private", label: "Mentor-Only Private Event" }
];

function joinMeetingLabel() {
  return "Join Meeting";
}

export function CalendarEventDetailModal({ event, role, mentorName, studentName, students = [], onClose, onEdit, onDelete }) {
  if (!event) return null;

  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : start;
  const isMeeting = event.extendedProps?.meeting || event.category === "mentor_meeting";
  const meeting = event.extendedProps?.meeting;
  const meetingType = event.extendedProps?.meetingType || meeting?.meetingType;
  const joinUrl = event.extendedProps?.zoomJoinUrl || meeting?.zoomJoinUrl;
  const zoomHost = meeting?.zoomHostUrl;
  const isPrivate = event.extendedProps?.mentorOnly || event.category === "mentor_private";
  const manageable = event.extendedProps?.manageable;
  const canEdit = Boolean(onEdit) && manageable !== false;
  const canDelete = Boolean(onDelete) && manageable !== false;
  const showJoin = isValidZoomJoinUrl(joinUrl) && meetingType !== "in_person";

  return (
    <Modal
      open
      onClose={onClose}
      title={event.title}
      footer={
        <div className="dash-modal__footer-actions">
          {showJoin ? (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="dash-btn dash-btn--primary dash-modal__join-btn"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              <span>{joinMeetingLabel()}</span>
            </a>
          ) : null}
          {canEdit && onEdit ? <SecondaryButton type="button" onClick={() => onEdit(event)}>Edit plan</SecondaryButton> : null}
          {canDelete && onDelete ? (
            <button type="button" className="dash-btn dash-btn--danger" onClick={() => onDelete(event)}>
              Delete
            </button>
          ) : null}
          <SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>
        </div>
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
        {isMeeting || meetingType ? (
          <div>
            <dt>Meeting type</dt>
            <dd>{meetingType === "google_meet" ? "Google Meet" : meetingType === "zoom" ? "Zoom" : meetingType || "—"}</dd>
          </div>
        ) : null}
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

const DEFAULT_FORM = {
  title: "",
  category: "personal_task",
  date: "",
  startTime: "",
  endTime: "",
  description: "",
  meetingType: "zoom",
  studentId: "",
  shared: true,
  zoom: true,
  calendarColor: "",
  reminderMinutes: getDefaultReminderMinutes(),
  zoomJoinUrl: ""
};

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date) {
  return date.toTimeString().slice(0, 5);
}

function addHoursToTime(time24, hours = 1) {
  if (!time24 || time24.length < 5) return "";
  const [h, m] = time24.split(":").map((part) => parseInt(part, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const totalMinutes = h * 60 + m + hours * 60;
  const nextHour = Math.floor(totalMinutes / 60) % 24;
  const nextMinute = totalMinutes % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function buildFormFromEvent(initialEvent, initialCategory) {
  const start = new Date(initialEvent.start);
  const end = new Date(initialEvent.end || initialEvent.start);

  return {
    ...DEFAULT_FORM,
    title: initialEvent.title || "",
    category: initialEvent.category || initialCategory,
    date: toDateInputValue(start),
    startTime: toTimeInputValue(start),
    endTime: toTimeInputValue(end),
    description: initialEvent.description || "",
    meetingType: initialEvent.meetingType || "zoom",
    studentId: initialEvent.studentId || initialEvent.raw?.studentId || "",
    calendarColor: initialEvent.pillColor || "",
    reminderMinutes: initialEvent.reminderMinutes || getDefaultReminderMinutes(),
    zoomJoinUrl: initialEvent.zoomJoinUrl || initialEvent.raw?.zoomJoinUrl || ""
  };
}

export function CalendarAddEventModal({
  open,
  onClose,
  role,
  students = [],
  onSave,
  initialCategory = "personal_task",
  initialEvent = null,
  modalTitle = "Add event",
  formVariant = "full",
  submitLabel,
  meetingRequestMode = false,
  onRequestMeeting,
  inline = false,
  defaultStudentId = ""
}) {
  const [form, setForm] = useState({ ...DEFAULT_FORM, category: initialCategory });
  const [errors, setErrors] = useState({});
  const [requestSent, setRequestSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [scheduledMeeting, setScheduledMeeting] = useState(null);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissionWarning, setPermissionWarning] = useState("");
  const [reminderSavedWarning, setReminderSavedWarning] = useState("");
  const endTimeManuallyEdited = useRef(false);
  const isEventForm = formVariant === "event";
  const isTaskForm = formVariant === "task";
  const isSimplifiedForm = isEventForm || isTaskForm;
  const showStudentEventChoice = meetingRequestMode && isEventForm && !initialEvent && role === "student";
  const lockedStudent = students.find((student) => student.id === defaultStudentId);
  useEffect(() => {
    if (!open && !inline) return;
    endTimeManuallyEdited.current = false;
    if (initialEvent) {
      setForm(buildFormFromEvent(initialEvent, initialCategory));
    } else {
      setForm({
        ...DEFAULT_FORM,
        category: initialCategory,
        reminderMinutes: getDefaultReminderMinutes(),
        studentId: defaultStudentId || ""
      });
    }
    setErrors({});
    setRequestSent(false);
    setSubmitting(false);
    setSubmitError("");
    setScheduledMeeting(null);
    setPermissionWarning("");
    setReminderSavedWarning("");
  }, [open, inline, initialCategory, initialEvent, defaultStudentId]);

  function handleStartTimeChange(startTime) {
    setForm((current) => {
      const next = { ...current, startTime };
      if (!endTimeManuallyEdited.current && startTime?.length >= 5) {
        next.endTime = addHoursToTime(startTime, 1);
      }
      return next;
    });
  }

  function handleEndTimeChange(endTime) {
    endTimeManuallyEdited.current = true;
    setForm((current) => ({ ...current, endTime }));
  }

  function updatePermissionWarning(reminderMinutes) {
    const permission = getNotificationPermission();
    if (permission === "unsupported") {
      setPermissionWarning("Browser notifications are not supported in this environment.");
      return;
    }
    if (reminderMinutes === "none") {
      setPermissionWarning("");
      setReminderSavedWarning("");
      return;
    }
    if (permission === "denied") {
      setPermissionWarning("Notifications are blocked. Enable them in your browser settings to receive reminders.");
      setReminderSavedWarning("");
      return;
    }
    if (permission === "default") {
      setPermissionWarning("");
      return;
    }
    setPermissionWarning("");
    setReminderSavedWarning("");
  }

  function handleReminderChange(value) {
    setForm((current) => ({ ...current, reminderMinutes: value }));
    updatePermissionWarning(value);
    if (value !== "none" && getNotificationPermission() === "default") {
      setPermissionModalOpen(true);
    }
  }

  async function handleAllowNotifications() {
    if (!("Notification" in window)) {
      setPermissionModalOpen(false);
      setReminderSavedWarning("Browser notifications are not supported in this environment.");
      return;
    }
    const result = await Notification.requestPermission();
    setPermissionModalOpen(false);
    if (result !== "granted") {
      setReminderSavedWarning("Reminder saved, but browser notifications are disabled unless you allow them.");
    } else {
      setReminderSavedWarning("");
      setPermissionWarning("");
    }
  }

  function handleDismissNotifications() {
    setPermissionModalOpen(false);
    if (form.reminderMinutes !== "none") {
      setReminderSavedWarning("Reminder saved. Enable notifications to receive browser alerts.");
    }
  }

  function validate() {
    const next = {};
    if (!form.title.trim()) next.title = "Title is required.";
    if (!form.date || form.date.length < 10) next.date = "Enter a complete date (mm/dd/yyyy).";
    if (!isTaskForm) {
      if (!form.startTime || form.startTime.length < 5) next.startTime = "Enter a complete start time.";
      if (!form.endTime || form.endTime.length < 5) next.endTime = "Enter a complete end time.";
      if (form.startTime && form.endTime && form.endTime <= form.startTime) next.endTime = "End must be after start.";
    }
    if (role === "mentor" && !defaultStudentId && (isEventForm || (!isSimplifiedForm && form.category === "mentor_meeting")) && !form.studentId) {
      next.studentId = "Select a student.";
    }
    if (role === "mentor" && isEventForm && form.meetingType === "zoom") {
      if (!isValidZoomJoinUrl(form.zoomJoinUrl)) {
        next.zoomJoinUrl = "Paste a valid Zoom link (https://zoom.us/j/…).";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e, submitMode = "direct") {
    e?.preventDefault?.();
    if (!validate()) return;

    const start = isTaskForm
      ? new Date(`${form.date}T09:00:00`)
      : new Date(`${form.date}T${form.startTime}`);
    const end = isTaskForm
      ? new Date(`${form.date}T09:00:00`)
      : new Date(`${form.date}T${form.endTime}`);

    const meetingType = isTaskForm ? "zoom" : form.meetingType;
    const sendToMentor = submitMode === "mentor";

    if (sendToMentor) {
      setSubmitting(true);
      setSubmitError("");
      try {
        const meeting = await onRequestMeeting?.({
          title: form.title.trim(),
          meetingType,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          notes: form.description,
          status: "pending"
        });
        setRequestSent(true);
        if (meeting?.zoomJoinUrl) {
          setScheduledMeeting(meeting);
        }
      } catch (error) {
        setSubmitError(error?.message || "Could not send your meeting request. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const resolvedStudentId = form.studentId || defaultStudentId || undefined;
    const selectedStudent = students.find((s) => s.id === resolvedStudentId);

    setSubmitting(true);
    setSubmitError("");
    try {
      const stored = await onSave?.({
        id: initialEvent?.id || `evt-${Date.now()}`,
        title: form.title.trim(),
        category: isTaskForm ? "personal_task" : isEventForm ? "mentor_meeting" : form.category,
        start: start.toISOString(),
        end: end.toISOString(),
        description: form.description,
        studentId: resolvedStudentId,
        studentName: selectedStudent?.name,
        shared: role === "mentor" && isEventForm ? true : form.shared,
        mentorOnly: role === "mentor" && isEventForm ? false : (!form.shared && role === "mentor"),
        meetingType,
        zoomJoinUrl: role === "mentor" && meetingType === "zoom" ? normalizeZoomJoinUrl(form.zoomJoinUrl) : undefined,
        formVariant: isTaskForm ? "task" : isEventForm ? "event" : undefined,
        calendarItemType: isTaskForm ? "task" : isEventForm ? "event" : undefined,
        pillColor: form.calendarColor || undefined,
        reminderMinutes: isSimplifiedForm ? form.reminderMinutes : "none",
        status: "scheduled"
      });

      if (isValidZoomJoinUrl(stored?.zoomJoinUrl) && meetingType === "zoom" && isEventForm) {
        setScheduledMeeting(stored);
        return;
      }

      resetFormState();
      onClose();
    } catch (error) {
      setSubmitError(error?.message || "Could not save this event. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetFormState() {
    setForm({ ...DEFAULT_FORM, category: initialCategory, reminderMinutes: getDefaultReminderMinutes() });
    setErrors({});
    setRequestSent(false);
    setSubmitting(false);
    setSubmitError("");
    setScheduledMeeting(null);
    setPermissionWarning("");
    setReminderSavedWarning("");
    endTimeManuallyEdited.current = false;
  }

  function handleDoneAfterSchedule() {
    resetFormState();
    onClose();
  }

  if (!open && !inline) return null;

  const titleLabel = isTaskForm ? "Task title" : "Event title";
  const resolvedSubmitLabel = submitLabel ?? (isTaskForm ? "Save task" : "Save event");
  const zoomReady = isValidZoomJoinUrl(scheduledMeeting?.zoomJoinUrl);

  const formNode = zoomReady ? (
    <div className="dash-modal__body dash-schedule-form__zoom-ready" role="status">
      <p className="dash-schedule-form__success-title">Meeting scheduled.</p>
      <p className="dash-muted">{scheduledMeeting.title || "Meeting"} was added to the calendar.</p>
      <JoinZoomButton href={scheduledMeeting.zoomJoinUrl} className="dash-btn dash-btn--primary" label="Join Meeting" />
      <SecondaryButton type="button" onClick={handleDoneAfterSchedule}>Done</SecondaryButton>
    </div>
  ) : (
        <form
          className={cn(
            "dash-event-form",
            inline ? "dash-inline-event-form paper-card" : "dash-modal__body",
            isTaskForm && "dash-event-form--task",
            isEventForm && "dash-event-form--event"
          )}
          onSubmit={handleSubmit}
        >
          <label className="prelude-field">
            <span>{titleLabel}</span>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            {errors.title ? <em className="dash-field-error">{errors.title}</em> : null}
          </label>
          {!isSimplifiedForm ? (
            <label className="prelude-field">
              <span>Category</span>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter((c) => role === "mentor" || c.value !== "mentor_private").map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="prelude-field">
            <span>Date</span>
            {isSimplifiedForm ? (
              <MaskedDateInput value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
            ) : (
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            )}
            {errors.date ? <em className="dash-field-error">{errors.date}</em> : null}
          </label>
          {!isTaskForm ? (
            <div className="dash-event-form__row">
              <label className="prelude-field">
                <span>Start time</span>
                {isSimplifiedForm ? (
                  <MaskedTimeInput value={form.startTime} onChange={handleStartTimeChange} />
                ) : (
                  <input type="time" value={form.startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
                )}
                {errors.startTime ? <em className="dash-field-error">{errors.startTime}</em> : null}
              </label>
              <label className="prelude-field">
                <span>End time</span>
                {isSimplifiedForm ? (
                  <MaskedTimeInput value={form.endTime} onChange={handleEndTimeChange} />
                ) : (
                  <input type="time" value={form.endTime} onChange={(e) => handleEndTimeChange(e.target.value)} />
                )}
                {errors.endTime ? <em className="dash-field-error">{errors.endTime}</em> : null}
              </label>
            </div>
          ) : null}
          <label className={cn(
            "prelude-field dash-form-full dash-event-form__description",
            isEventForm && meetingRequestMode && "dash-schedule-form__notes"
          )}>
            <span>{isEventForm && meetingRequestMode ? "Notes" : "Description"}</span>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </label>
          {role === "mentor" && isEventForm ? (
            defaultStudentId && lockedStudent ? (
              <label className="prelude-field">
                <span>Student</span>
                <input type="text" value={lockedStudent.name} readOnly className="dash-input dash-input--readonly" />
              </label>
            ) : (
              <label className="prelude-field">
                <span>Student</span>
                <select value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}>
                  <option value="">Select a student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {errors.studentId ? <em className="dash-field-error">{errors.studentId}</em> : null}
              </label>
            )
          ) : null}
          {role === "mentor" && !isSimplifiedForm ? (
            <>
              {defaultStudentId && lockedStudent ? (
                <label className="prelude-field">
                  <span>Student (for meetings)</span>
                  <input type="text" value={lockedStudent.name} readOnly className="dash-input dash-input--readonly" />
                </label>
              ) : (
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
              )}
              <label className="dash-check-label">
                <input type="checkbox" checked={form.shared} onChange={(e) => setForm((f) => ({ ...f, shared: e.target.checked }))} />
                Shared with student (uncheck for private mentor-only)
              </label>
            </>
          ) : null}
          {isEventForm && role === "mentor" ? (
            <label className="prelude-field">
              <span>Zoom meeting link</span>
              <input
                type="url"
                value={form.zoomJoinUrl}
                onChange={(e) => setForm((f) => ({ ...f, meetingType: "zoom", zoomJoinUrl: e.target.value }))}
                placeholder="https://zoom.us/j/1234567890"
                autoComplete="off"
              />
              <em className="dash-field-hint">Schedule the meeting in Zoom first, then paste the join link here.</em>
              {errors.zoomJoinUrl ? <em className="dash-field-error">{errors.zoomJoinUrl}</em> : null}
            </label>
          ) : null}
          {isSimplifiedForm ? (
            <label className="prelude-field">
              <span>Notification reminder</span>
              <select
                value={form.reminderMinutes}
                onChange={(e) => handleReminderChange(e.target.value)}
              >
                {REMINDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {permissionWarning ? (
                <em className="dash-field-hint dash-field-hint--warning">{permissionWarning}</em>
              ) : null}
              {!permissionWarning && reminderSavedWarning ? (
                <em className="dash-field-hint">{reminderSavedWarning}</em>
              ) : null}
            </label>
          ) : null}
          {isSimplifiedForm ? (
            <fieldset className="prelude-field dash-color-picker-field">
              <legend>Calendar color</legend>
              <div className="dash-color-picker" role="radiogroup" aria-label="Calendar color">
                {CALENDAR_COLOR_OPTIONS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    role="radio"
                    aria-checked={form.calendarColor === color.value}
                    aria-label={color.label}
                    className={cn(
                      "dash-color-picker__swatch",
                      `dash-color-picker__swatch--${color.value}`,
                      form.calendarColor === color.value && "dash-color-picker__swatch--active"
                    )}
                    onClick={() => setForm((f) => ({
                      ...f,
                      calendarColor: f.calendarColor === color.value ? "" : color.value
                    }))}
                  />
                ))}
              </div>
            </fieldset>
          ) : null}
          {!isSimplifiedForm ? (
            <label className="prelude-field">
              <span>Meeting type</span>
              <select value={form.meetingType} onChange={(e) => setForm((f) => ({ ...f, meetingType: e.target.value }))}>
                <option value="zoom">Zoom</option>
                <option value="google_meet">Google Meet</option>
              </select>
            </label>
          ) : null}
          <div className={cn(
            "dash-modal__footer dash-modal__footer--inline dash-modal__footer--stacked",
            inline && "dash-inline-event-form__footer"
          )}>
            <div className="dash-modal__footer-actions">
              {!inline ? <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton> : null}
              {showStudentEventChoice ? (
                <>
                  <SecondaryButton
                    type="button"
                    disabled={submitting}
                    onClick={(event) => handleSubmit(event, "mentor")}
                  >
                    {submitting ? "Sending…" : "Send to mentor for review"}
                  </SecondaryButton>
                  <PrimaryButton
                    type="button"
                    disabled={submitting}
                    onClick={(event) => handleSubmit(event, "direct")}
                  >
                    {submitting ? "Saving…" : "Add to my calendar"}
                  </PrimaryButton>
                </>
              ) : (
                <PrimaryButton type="submit" disabled={submitting}>
                  {resolvedSubmitLabel}
                </PrimaryButton>
              )}
            </div>
            {meetingRequestMode && requestSent && !showStudentEventChoice ? (
              <div className="dash-schedule-form__request-sent" role="status">
                <p>A request has been sent to your mentor for review.</p>
                {isValidZoomJoinUrl(scheduledMeeting?.zoomJoinUrl) ? (
                  <p>
                    Join link:{" "}
                    <a href={scheduledMeeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-link">
                      {scheduledMeeting.zoomJoinUrl}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
            {submitError ? (
              <p className="dash-schedule-form__form-error" role="alert">{submitError}</p>
            ) : null}
          </div>
        </form>
  );

  if (inline) {
    return (
      <>
        {formNode}
        <NotificationPermissionModal
          open={permissionModalOpen}
          onAllow={handleAllowNotifications}
          onDismiss={handleDismissNotifications}
        />
      </>
    );
  }

  const modalNode = (
    <div className="dash-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="dash-modal dash-modal--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="dash-modal__head">
          <h2 className="dash-modal__title">{modalTitle}</h2>
          <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        {formNode}
      </div>
      <NotificationPermissionModal
        open={permissionModalOpen}
        onAllow={handleAllowNotifications}
        onDismiss={handleDismissNotifications}
      />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : modalNode;
}
