import { Check } from "lucide-react";
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

export function SaveRow({ section, savedSection, onSave }) {
  return (
    <div className="dash-form-actions">
      {savedSection === section ? (
        <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Saved</span>
      ) : null}
      <PrimaryButton type="button" className="dash-btn--sm" onClick={() => onSave(section)}>Save changes</PrimaryButton>
    </div>
  );
}
