import { AlertCircle, Check } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { PrimaryButton } from "../ui/index.jsx";

export function SettingToggle({ id, checked, onChange, label, description }) {
  return (
    <div className="dash-setting-row">
      <div className="dash-setting-row__text">
        <label htmlFor={id} className="dash-setting-row__label">{label}</label>
        {description ? <p className="dash-setting-row__desc">{description}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn("dash-toggle", checked && "dash-toggle--on")}
        onClick={() => onChange(!checked)}
      >
        <span className="dash-toggle__thumb" />
      </button>
    </div>
  );
}

export function SettingSelect({ id, label, description, value, onChange, options }) {
  return (
    <div className="dash-setting-row">
      <div className="dash-setting-row__text">
        <label htmlFor={id} className="dash-setting-row__label">{label}</label>
        {description ? <p className="dash-setting-row__desc">{description}</p> : null}
      </div>
      <select id={id} className="dash-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function SaveRow({ section, saveState, onSave, dirty = true }) {
  const isCurrent = saveState?.section === section;
  const isSaving = isCurrent && saveState.status === "saving";
  const showButton = dirty || isSaving;
  return (
    <div className={`dash-form-actions${dirty ? " dash-form-actions--dirty" : ""}`}>
      {dirty ? <span className="dash-save-state" role="status">Unsaved changes</span> : null}
      {isCurrent && saveState.status === "saved" ? (
        <span className="dash-save-state dash-save-state--ok" role="status" aria-live="polite"><Check className="h-4 w-4" /> Saved</span>
      ) : null}
      {isCurrent && saveState.status === "error" ? (
        <span className="dash-save-state dash-save-state--error" role="alert"><AlertCircle className="h-4 w-4" /> {saveState.message}</span>
      ) : null}
      {dirty || isCurrent ? null : <span className="dash-save-state dash-save-state--ok" role="status"><Check className="h-4 w-4" /> Saved</span>}
      {showButton ? (
        <PrimaryButton type="button" className="dash-btn--sm" onClick={() => onSave(section)} disabled={!dirty || isSaving}>
          {isSaving ? "Saving…" : "Save changes"}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
