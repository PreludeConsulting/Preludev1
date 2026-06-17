import { useEffect, useMemo, useState } from "react";
import {
  buildTimeOptions,
  DAYS,
  formatAvailabilityRange,
  TIMEZONES
} from "../../lib/mentorAvailability.js";
import { Modal, PrimaryButton, SecondaryButton } from "../ui/index.jsx";

const TIME_OPTIONS = buildTimeOptions();

function AvailabilityEditorForm({ initialSlot, onSave, onCancel }) {
  const [day, setDay] = useState(initialSlot.day);
  const [startTime, setStartTime] = useState(initialSlot.startTime);
  const [endTime, setEndTime] = useState(initialSlot.endTime);
  const [timezone, setTimezone] = useState(initialSlot.timezone || "ET");
  const [recurring, setRecurring] = useState(initialSlot.recurring !== false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDay(initialSlot.day);
    setStartTime(initialSlot.startTime);
    setEndTime(initialSlot.endTime);
    setTimezone(initialSlot.timezone || "ET");
    setRecurring(initialSlot.recurring !== false);
    setError("");
  }, [initialSlot]);

  const preview = useMemo(
    () => formatAvailabilityRange(startTime, endTime, timezone),
    [startTime, endTime, timezone]
  );

  function handleSubmit(event) {
    event.preventDefault();

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    if (endMinutes <= startMinutes) {
      setError("End time must be after start time.");
      return;
    }

    onSave({
      ...initialSlot,
      day,
      startTime,
      endTime,
      timezone,
      time: preview,
      recurring,
      active: true
    });
  }

  return (
    <form className="dash-mentor-availability-editor" onSubmit={handleSubmit}>
      <label className="prelude-field">
        <span>Day of week</span>
        <select value={day} onChange={(event) => setDay(event.target.value)}>
          {DAYS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="dash-mentor-availability-editor__times">
        <label className="prelude-field">
          <span>Start time</span>
          <select value={startTime} onChange={(event) => setStartTime(event.target.value)}>
            {TIME_OPTIONS.map((option) => (
              <option key={`start-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="prelude-field">
          <span>End time</span>
          <select value={endTime} onChange={(event) => setEndTime(event.target.value)}>
            {TIME_OPTIONS.map((option) => (
              <option key={`end-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="prelude-field">
        <span>Timezone</span>
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {TIMEZONES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="dash-mentor-availability-editor__recurring">
        <input
          type="checkbox"
          checked={recurring}
          onChange={(event) => setRecurring(event.target.checked)}
        />
        <span>Repeat weekly</span>
      </label>

      {preview ? (
        <p className="dash-mentor-availability-editor__preview">
          Students will see: <strong>{day}</strong> · {preview}
        </p>
      ) : null}

      {error ? (
        <p className="dash-mentor-availability-editor__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="dash-mentor-availability-editor__footer">
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <PrimaryButton type="submit">Save availability</PrimaryButton>
      </div>
    </form>
  );
}

export default function MentorAvailabilityEditorModal({ open, slot, mode, onClose, onSave }) {
  if (!slot) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "edit" ? "Edit availability" : "Add availability"}
      className="dash-modal--availability"
    >
      <AvailabilityEditorForm
        key={slot.id}
        initialSlot={slot}
        onSave={(next) => {
          onSave(next);
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
