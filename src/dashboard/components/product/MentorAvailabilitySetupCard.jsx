import { ChevronDown, Globe, Info } from "lucide-react";
import { PrimaryButton } from "../ui/index.jsx";
import { buildTimeOptions, TIMEZONES } from "../../lib/mentorAvailability.js";

const TIME_OPTIONS = buildTimeOptions();

function DayTimeSelect({ value, onChange, label, disabled }) {
  return (
    <label className={`dash-mentor-avail-setup__select dash-mentor-avail-setup__select--row${disabled ? " dash-mentor-avail-setup__select--disabled" : ""}`}>
      <span className="dash-mentor-avail-setup__time-label">{label}</span>
      <div className="dash-mentor-avail-setup__select-wrap">
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        >
          {TIME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="dash-mentor-avail-setup__chevron" aria-hidden="true" />
      </div>
    </label>
  );
}

export default function MentorAvailabilitySetupCard({
  form,
  error,
  success,
  saving = false,
  onChange,
  onSave,
  showSaveButton = true,
  saveLabel = "Save availability"
}) {
  function updateDay(dayOfWeek, patch) {
    onChange({
      ...form,
      days: form.days.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day))
    });
  }

  function toggleDay(dayOfWeek, enabled) {
    updateDay(dayOfWeek, { enabled });
  }

  return (
    <article className="dash-mentor-avail-setup">
      <section className="dash-mentor-avail-setup__section">
        <h2 className="dash-mentor-avail-setup__label">Timezone</h2>
        <label className="dash-mentor-avail-setup__select dash-mentor-avail-setup__select--timezone">
          <Globe className="dash-mentor-avail-setup__field-icon" aria-hidden="true" />
          <span className="sr-only">Timezone</span>
          <select
            value={form.timezone}
            onChange={(event) => onChange({ ...form, timezone: event.target.value })}
            aria-label="Timezone"
          >
            {TIMEZONES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="dash-mentor-avail-setup__chevron" aria-hidden="true" />
        </label>
      </section>

      <section className="dash-mentor-avail-setup__section">
        <h2 className="dash-mentor-avail-setup__label">Available days</h2>
        <div className="dash-mentor-avail-setup__day-list">
          {form.days.map((day) => (
            <div
              key={day.dayOfWeek}
              className={
                day.enabled
                  ? "dash-mentor-avail-setup__day-row dash-mentor-avail-setup__day-row--enabled"
                  : "dash-mentor-avail-setup__day-row"
              }
            >
              <label className="dash-mentor-avail-setup__day-check">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) => toggleDay(day.dayOfWeek, event.target.checked)}
                  aria-label={`Enable ${day.dayOfWeek}`}
                />
              </label>

              <span className="dash-mentor-avail-setup__day-name">{day.dayOfWeek}</span>

              <DayTimeSelect
                label="Start time"
                value={day.startTime}
                disabled={!day.enabled}
                onChange={(startTime) => updateDay(day.dayOfWeek, { startTime })}
              />

              <DayTimeSelect
                label="End time"
                value={day.endTime}
                disabled={!day.enabled}
                onChange={(endTime) => updateDay(day.dayOfWeek, { endTime })}
              />
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="dash-mentor-avail-setup__error" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="dash-mentor-avail-setup__success" role="status">
          Availability saved. Students can now book during your selected hours.
        </p>
      ) : null}

      {showSaveButton ? (
        <footer className="dash-mentor-avail-setup__footer">
          <p className="dash-mentor-avail-setup__tip">
            <Info className="dash-mentor-avail-setup__tip-icon" aria-hidden="true" />
            You can customize your availability anytime.
          </p>
          <PrimaryButton type="button" className="dash-mentor-avail-setup__save" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : error ? "Retry save" : saveLabel}
          </PrimaryButton>
        </footer>
      ) : null}
    </article>
  );
}
