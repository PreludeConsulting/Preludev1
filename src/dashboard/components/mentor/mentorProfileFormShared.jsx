import { useEffect, useMemo, useRef, useState } from "react";
import {
  MENTOR_APPLICATION_STRENGTHS,
  MENTOR_PROGRAM_OPTIONS,
  MENTOR_SPECIALTIES,
  MENTOR_SUPPORT_STYLES,
  MENTOR_TARGET_MAJORS
} from "../../../data/mentorQuestionnaire.js";
import { EXPLORE_COLLEGES } from "../../data/collegeExploreData.js";

export const EMPTY_MENTOR_PROFILE_FORM = {
  college: "",
  major: "",
  bio: "",
  specialties: [],
  targetMajors: [],
  targetSchools: [],
  supportStyles: [],
  applicationStrengths: [],
  availability: "",
  additionalNotes: ""
};

export const MENTOR_COLLEGE_DATABASE_OPTIONS = Array.from(
  new Set((EXPLORE_COLLEGES || []).map((college) => String(college?.name || "").trim()).filter(Boolean))
).sort((a, b) => a.localeCompare(b));

export function cleanText(value) {
  return String(value || "").trim();
}

export function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function mentorProfileFormFromData(questionnaire, matchingProfile) {
  const answers = questionnaire?.answers || {};
  return {
    ...EMPTY_MENTOR_PROFILE_FORM,
    ...answers,
    college: answers.college ?? matchingProfile?.college ?? "",
    major: answers.major ?? matchingProfile?.major ?? "",
    bio: answers.bio ?? matchingProfile?.bio ?? "",
    specialties: asArray(answers.specialties ?? matchingProfile?.specialties),
    targetMajors: asArray(answers.targetMajors ?? matchingProfile?.target_majors),
    targetSchools: asArray(answers.targetSchools ?? matchingProfile?.target_schools),
    supportStyles: asArray(answers.supportStyles ?? matchingProfile?.support_styles),
    applicationStrengths: asArray(answers.applicationStrengths ?? matchingProfile?.application_strengths),
    availability: answers.availability ?? matchingProfile?.availability ?? "",
    additionalNotes: answers.additionalNotes ?? ""
  };
}

export function validateMentorProfileForm(form, { requireAvailabilityNotes = true } = {}) {
  const errors = {};
  if (!cleanText(form.college)) errors.college = "Choose or enter your college.";
  if (!cleanText(form.major)) errors.major = "Choose or enter your major.";
  if (!cleanText(form.bio)) errors.bio = "Add a mentor bio.";
  if (!asArray(form.specialties).length) errors.specialties = "Choose at least one area.";
  if (!asArray(form.targetMajors).length) errors.targetMajors = "Choose at least one academic area.";
  if (!asArray(form.supportStyles).length) errors.supportStyles = "Choose at least one support style.";
  if (!asArray(form.applicationStrengths).length) errors.applicationStrengths = "Choose at least one strength.";
  if (requireAvailabilityNotes && !cleanText(form.availability)) {
    errors.availability = "Add availability notes.";
  }
  return errors;
}

export function normalizeMentorProfilePayload(form) {
  return {
    college: cleanText(form.college),
    major: cleanText(form.major),
    bio: cleanText(form.bio),
    specialties: asArray(form.specialties),
    targetMajors: asArray(form.targetMajors),
    targetSchools: asArray(form.targetSchools),
    supportStyles: asArray(form.supportStyles),
    applicationStrengths: asArray(form.applicationStrengths),
    availability: cleanText(form.availability),
    additionalNotes: cleanText(form.additionalNotes)
  };
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function filterAutocompleteOptions(options, query) {
  const needle = normalizeSearchValue(query);
  if (!needle) return options.slice(0, 120);
  return options.filter((option) => normalizeSearchValue(option).includes(needle)).slice(0, 120);
}

export function MentorAutocompleteInput({
  value,
  onChange,
  options,
  onSelectOption,
  onSubmitValue = null,
  placeholder = "",
  ariaInvalid = false
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => filterAutocompleteOptions(options, value), [options, value]);

  useEffect(() => {
    const nextMax = Math.max(filtered.length - 1, 0);
    setActiveIndex((current) => Math.min(current, nextMax));
  }, [filtered.length]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function commitSelection(option) {
    onSelectOption(option);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && filtered[activeIndex]) {
        commitSelection(filtered[activeIndex]);
      } else if (onSubmitValue) {
        onSubmitValue();
        setOpen(false);
      }
    }
  }

  return (
    <div className="dash-autocomplete" ref={rootRef}>
      <input
        className="dash-input dash-autocomplete__input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        autoComplete="off"
      />
      {open ? (
        <div className="dash-autocomplete__menu" role="listbox">
          {filtered.length ? (
            filtered.map((option, index) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`dash-autocomplete__option${index === activeIndex ? " dash-autocomplete__option--active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitSelection(option);
                }}
              >
                {option}
              </button>
            ))
          ) : (
            <div className="dash-autocomplete__empty" role="status">
              No results found
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function MentorMultiSelect({ label, options, value, onChange, error }) {
  const selected = asArray(value);

  function toggle(option) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <section className="dash-field dash-mentor-profile-settings__group">
      <h3 className="dash-mentor-profile-settings__heading">{label}</h3>
      <p className="dash-mentor-profile-settings__hint">Select all that apply</p>
      <div className="dash-mentor-profile-settings__container">
        <div className="dash-mentor-profile-settings__chips">
          {options.map((option) => (
            <label
              key={option}
              className={`dash-mentor-profile-settings__chip${selected.includes(option) ? " dash-mentor-profile-settings__chip--selected" : ""}`}
            >
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
      {error ? <em>{error}</em> : null}
    </section>
  );
}

export function MentorListEditor({ label, value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const selected = asArray(value);

  function addItem() {
    const next = cleanText(draft);
    if (!next || selected.includes(next)) return;
    onChange([...selected, next]);
    setDraft("");
  }

  return (
    <section className="dash-field dash-mentor-profile-settings__group">
      <span>{label}</span>
      <div className="dash-mentor-profile-settings__add-row">
        <MentorAutocompleteInput
          value={draft}
          onChange={setDraft}
          options={MENTOR_COLLEGE_DATABASE_OPTIONS}
          onSelectOption={(option) => {
            if (selected.includes(option)) {
              setDraft("");
              return;
            }
            onChange([...selected, option]);
            setDraft("");
          }}
          onSubmitValue={addItem}
          placeholder={placeholder}
          ariaInvalid={false}
        />
        <button
          type="button"
          className="dash-btn dash-btn--secondary dash-btn--sm"
          onClick={addItem}
          disabled={!cleanText(draft)}
        >
          Add
        </button>
      </div>
      {selected.length ? (
        <div className="dash-tags">
          {selected.map((item) => (
            <button
              key={item}
              type="button"
              className="dash-mentor-profile-settings__tag"
              onClick={() => onChange(selected.filter((selectedItem) => selectedItem !== item))}
            >
              {item}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="dash-muted">No schools added yet.</p>
      )}
    </section>
  );
}

export function MentorProfileFormFields({ form, errors = {}, onChange }) {
  function updateField(key, value) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="dash-mentor-profile-settings">
      <div className="dash-form-grid dash-form-grid--settings">
        <label className="dash-field">
          <span>College or university</span>
          <MentorAutocompleteInput
            value={form.college}
            onChange={(next) => updateField("college", next)}
            options={MENTOR_COLLEGE_DATABASE_OPTIONS}
            onSelectOption={(option) => updateField("college", option)}
            placeholder="Search colleges"
            ariaInvalid={Boolean(errors.college)}
          />
          {errors.college ? <em>{errors.college}</em> : null}
        </label>
        <label className="dash-field">
          <span>Major or program</span>
          <MentorAutocompleteInput
            value={form.major}
            onChange={(next) => updateField("major", next)}
            options={MENTOR_PROGRAM_OPTIONS}
            onSelectOption={(option) => updateField("major", option)}
            placeholder="Search majors or programs"
            ariaInvalid={Boolean(errors.major)}
          />
          {errors.major ? <em>{errors.major}</em> : null}
        </label>
        <label className="dash-field dash-form-full">
          <span>Mentor bio</span>
          <textarea
            className="dash-input dash-mentor-profile-settings__textarea"
            value={form.bio}
            onChange={(event) => updateField("bio", event.target.value)}
            rows={4}
            aria-invalid={Boolean(errors.bio)}
            placeholder="Share the admissions topics, student goals, and application moments where you are strongest."
          />
          {errors.bio ? <em>{errors.bio}</em> : null}
        </label>
        <label className="dash-field dash-form-full">
          <span>Availability notes</span>
          <textarea
            className="dash-input dash-mentor-profile-settings__textarea"
            value={form.availability}
            onChange={(event) => updateField("availability", event.target.value)}
            rows={3}
            aria-invalid={Boolean(errors.availability)}
            placeholder="Available weeknights, Sunday afternoons, or by request during application season."
          />
          {errors.availability ? <em>{errors.availability}</em> : null}
        </label>
        <MentorListEditor
          label="Target schools you know well"
          value={form.targetSchools}
          onChange={(value) => updateField("targetSchools", value)}
          placeholder="Add a college or university"
        />
        <label className="dash-field dash-form-full">
          <span>Other strengths or context</span>
          <textarea
            className="dash-input dash-mentor-profile-settings__textarea"
            value={form.additionalNotes}
            onChange={(event) => updateField("additionalNotes", event.target.value)}
            rows={3}
          />
        </label>
      </div>

      <MentorMultiSelect
        label="Where can you help students most?"
        options={MENTOR_SPECIALTIES}
        value={form.specialties}
        onChange={(value) => updateField("specialties", value)}
        error={errors.specialties}
      />
      <MentorMultiSelect
        label="Which academic areas are a strong fit?"
        options={MENTOR_TARGET_MAJORS}
        value={form.targetMajors}
        onChange={(value) => updateField("targetMajors", value)}
        error={errors.targetMajors}
      />
      <MentorMultiSelect
        label="What is your mentoring style?"
        options={MENTOR_SUPPORT_STYLES}
        value={form.supportStyles}
        onChange={(value) => updateField("supportStyles", value)}
        error={errors.supportStyles}
      />
      <MentorMultiSelect
        label="Which application strengths should matching consider?"
        options={MENTOR_APPLICATION_STRENGTHS}
        value={form.applicationStrengths}
        onChange={(value) => updateField("applicationStrengths", value)}
        error={errors.applicationStrengths}
      />
    </div>
  );
}
