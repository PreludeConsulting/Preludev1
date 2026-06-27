import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  MENTOR_APPLICATION_STRENGTHS,
  MENTOR_COLLEGE_OPTIONS,
  MENTOR_QUESTIONNAIRE_DEFAULTS,
  MENTOR_PROGRAM_OPTIONS,
  MENTOR_SPECIALTIES,
  MENTOR_SUPPORT_STYLES,
  MENTOR_TARGET_MAJORS
} from "../../data/mentorQuestionnaire.js";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { dashboardPathForRole, MENTOR_ONBOARDING_PATH, userNeedsMentorOnboarding } from "../../lib/onboardingRoutes.js";
import { loadMentorQuestionnaire, saveMentorQuestionnaire } from "../../lib/mentorQuestionnaireService.js";
import AppLink from "../AppLink.jsx";

const OTHER_VALUE = "__other__";

function Field({ label, children }) {
  return (
    <label className="mentor-onboarding__field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function isCompleteCustomValue(value) {
  return Boolean(value?.trim()) && value !== OTHER_VALUE;
}

function DropdownWithOther({ label, value, options, onChange, placeholder, otherPlaceholder }) {
  const selectedValue = options.includes(value) ? value : value ? OTHER_VALUE : "";
  const showOther = selectedValue === OTHER_VALUE;

  return (
    <Field label={label}>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option value={option} key={option}>{option}</option>
        ))}
        <option value={OTHER_VALUE}>Other</option>
      </select>
      {showOther ? (
        <input
          value={value === OTHER_VALUE ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={otherPlaceholder}
        />
      ) : null}
    </Field>
  );
}

function TargetSchoolsPicker({ value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const [choice, setChoice] = useState("");
  const [customSchool, setCustomSchool] = useState("");
  const availableOptions = MENTOR_COLLEGE_OPTIONS.filter((school) => !selected.includes(school));
  const canAddCustom = Boolean(customSchool.trim());

  function addSchool(school) {
    const trimmed = school.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
    setChoice("");
    setCustomSchool("");
  }

  function removeSchool(school) {
    onChange(selected.filter((item) => item !== school));
  }

  return (
    <section className="mentor-onboarding__field mentor-onboarding__target-schools">
      <span>Target schools you know well</span>
      <div className="mentor-onboarding__select-row">
        <select
          value={choice}
          onChange={(event) => {
            const nextChoice = event.target.value;
            setChoice(nextChoice);
            if (nextChoice && nextChoice !== OTHER_VALUE) addSchool(nextChoice);
          }}
        >
          <option value="">Select a school to add</option>
          {availableOptions.map((option) => (
            <option value={option} key={option}>{option}</option>
          ))}
          <option value={OTHER_VALUE}>Other</option>
        </select>
      </div>
      {choice === OTHER_VALUE ? (
        <div className="mentor-onboarding__select-row">
          <input
            value={customSchool}
            onChange={(event) => setCustomSchool(event.target.value)}
            placeholder="Add another college or university"
          />
          <button type="button" className="mentor-onboarding__add-button" onClick={() => addSchool(customSchool)} disabled={!canAddCustom}>
            Add
          </button>
        </div>
      ) : null}
      {selected.length ? (
        <div className="mentor-onboarding__selected-list" aria-label="Selected target schools">
          {selected.map((school) => (
            <button type="button" className="mentor-onboarding__selected-item" onClick={() => removeSchool(school)} key={school}>
              {school}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CheckboxGroup({ label, options, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];

  function toggle(option) {
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }

  return (
    <section className="mentor-onboarding__group">
      <h2>{label}</h2>
      <div className="mentor-onboarding__chips">
        {options.map((option) => (
          <label key={option} className={`mentor-onboarding__chip${selected.includes(option) ? " mentor-onboarding__chip--selected" : ""}`}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

export default function MentorQuestionnaireOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready, refreshUser } = useAuth();
  const [answers, setAnswers] = useState(MENTOR_QUESTIONNAIRE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const missingRequired = useMemo(() => {
    const missing = [];
    if (!isCompleteCustomValue(answers.college)) missing.push("college");
    if (!isCompleteCustomValue(answers.major)) missing.push("major");
    if (!answers.bio?.trim()) missing.push("bio");
    if (!answers.specialties?.length) missing.push("specialties");
    if (!answers.targetMajors?.length) missing.push("academic areas");
    if (!answers.supportStyles?.length) missing.push("support style");
    if (!answers.applicationStrengths?.length) missing.push("strengths");
    if (!answers.availability?.trim()) missing.push("availability");
    return missing;
  }, [answers]);

  useEffect(() => {
    let cancelled = false;
    async function loadExisting() {
      if (!user?.id || user.authProvider !== "supabase") {
        setLoading(false);
        return;
      }
      const { questionnaire, matchingProfile } = await loadMentorQuestionnaire(user.id);
      if (cancelled) return;
      const savedAnswers = questionnaire?.answers || {};
      setAnswers({
        ...MENTOR_QUESTIONNAIRE_DEFAULTS,
        ...savedAnswers,
        college: savedAnswers.college ?? matchingProfile?.college ?? "",
        major: savedAnswers.major ?? matchingProfile?.major ?? "",
        bio: savedAnswers.bio ?? matchingProfile?.bio ?? "",
        specialties: savedAnswers.specialties ?? matchingProfile?.specialties ?? [],
        targetMajors: savedAnswers.targetMajors ?? matchingProfile?.target_majors ?? [],
        targetSchools: savedAnswers.targetSchools ?? matchingProfile?.target_schools ?? [],
        supportStyles: savedAnswers.supportStyles ?? matchingProfile?.support_styles ?? [],
        applicationStrengths: savedAnswers.applicationStrengths ?? matchingProfile?.application_strengths ?? [],
        additionalNotes: savedAnswers.additionalNotes ?? "",
        availability: savedAnswers.availability ?? matchingProfile?.availability ?? ""
      });
      setLoading(false);
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.authProvider]);

  if (!ready || loading) {
    return <main className="pm-onboarding-page"><p className="text-muted-foreground">Loading...</p></main>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: MENTOR_ONBOARDING_PATH }} />;
  }

  if (roleFromUser(user) !== "mentor") {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  if (!userNeedsMentorOnboarding(user)) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  function update(field, value) {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (missingRequired.length) {
      setError(`Please complete: ${missingRequired.join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      const { error: saveError } = await saveMentorQuestionnaire(user, answers);
      if (saveError) throw new Error(saveError);
      await refreshUser();
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      setError(err.message || "Could not save your mentor profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pm-onboarding-page mentor-onboarding">
      <div className="pm-onboarding-page__inner mentor-onboarding__inner">
        <AppLink href="/" className="pm-onboarding-page__back">← Back to Prelude</AppLink>
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">Mentor onboarding</p>
          <h1 className="pm-onboarding-page__title">Build your matching profile</h1>
          <p className="pm-onboarding-page__sub">
            Tell us what kinds of students you can help most. We use this to rank mentor fit after students complete Prelude Match.
          </p>
        </header>

        {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}

        <form className="mentor-onboarding__form" onSubmit={onSubmit}>
          <section className="mentor-onboarding__panel">
            <div className="mentor-onboarding__split">
              <DropdownWithOther
                label="College or university"
                value={answers.college}
                options={MENTOR_COLLEGE_OPTIONS}
                onChange={(value) => update("college", value)}
                placeholder="Select your college"
                otherPlaceholder="Type your college or university"
              />
              <DropdownWithOther
                label="Major or program"
                value={answers.major}
                options={MENTOR_PROGRAM_OPTIONS}
                onChange={(value) => update("major", value)}
                placeholder="Select your major or program"
                otherPlaceholder="Type your major or program"
              />
            </div>

            <Field label="Mentor bio">
              <textarea
                value={answers.bio}
                onChange={(event) => update("bio", event.target.value)}
                rows={4}
                placeholder="Share the admissions topics, student goals, and application moments where you are strongest."
              />
            </Field>

            <TargetSchoolsPicker value={answers.targetSchools} onChange={(value) => update("targetSchools", value)} />
          </section>

          <CheckboxGroup label="Where can you help students most?" options={MENTOR_SPECIALTIES} value={answers.specialties} onChange={(value) => update("specialties", value)} />
          <CheckboxGroup label="Which academic areas are a strong fit?" options={MENTOR_TARGET_MAJORS} value={answers.targetMajors} onChange={(value) => update("targetMajors", value)} />
          <CheckboxGroup label="What is your mentoring style?" options={MENTOR_SUPPORT_STYLES} value={answers.supportStyles} onChange={(value) => update("supportStyles", value)} />
          <CheckboxGroup label="Which application strengths should matching consider?" options={MENTOR_APPLICATION_STRENGTHS} value={answers.applicationStrengths} onChange={(value) => update("applicationStrengths", value)} />

          <section className="mentor-onboarding__panel">
            <Field label="Other strengths or context">
              <textarea
                value={answers.additionalNotes}
                onChange={(event) => update("additionalNotes", event.target.value)}
                rows={3}
                placeholder="Add other strengths, programs you know, student groups you support well, or anything else students should know."
              />
            </Field>

            <Field label="Availability notes">
              <textarea
                value={answers.availability}
                onChange={(event) => update("availability", event.target.value)}
                rows={3}
                placeholder="Available weeknights, Sunday afternoons, or by request during application season."
              />
            </Field>
          </section>

          <footer className="mentor-onboarding__footer">
            <p>{missingRequired.length ? `${missingRequired.length} required section${missingRequired.length === 1 ? "" : "s"} remaining` : "Ready to save"}</p>
            <button type="submit" className="pm-btn pm-btn--primary pm-btn--lg" disabled={saving}>
              {saving ? "Saving..." : "Complete mentor onboarding"}
            </button>
          </footer>
        </form>
      </div>
    </main>
  );
}
