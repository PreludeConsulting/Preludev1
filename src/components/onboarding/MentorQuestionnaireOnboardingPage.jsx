import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  MENTOR_APPLICATION_STRENGTHS,
  MENTOR_QUESTIONNAIRE_DEFAULTS,
  MENTOR_SPECIALTIES,
  MENTOR_SUPPORT_STYLES,
  MENTOR_TARGET_MAJORS
} from "../../data/mentorQuestionnaire.js";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { dashboardPathForRole, MENTOR_ONBOARDING_PATH, userNeedsMentorOnboarding } from "../../lib/onboardingRoutes.js";
import { loadMentorQuestionnaire, saveMentorQuestionnaire } from "../../lib/mentorQuestionnaireService.js";
import AppLink from "../AppLink.jsx";

function Field({ label, children }) {
  return (
    <label className="mentor-onboarding__field">
      <span>{label}</span>
      {children}
    </label>
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

function commaList(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseCommaList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    if (!answers.college?.trim()) missing.push("college");
    if (!answers.major?.trim()) missing.push("major");
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
              <Field label="College or university">
                <input value={answers.college} onChange={(event) => update("college", event.target.value)} placeholder="Georgia Tech" />
              </Field>
              <Field label="Major or program">
                <input value={answers.major} onChange={(event) => update("major", event.target.value)} placeholder="Computer Science" />
              </Field>
            </div>

            <Field label="Mentor bio">
              <textarea
                value={answers.bio}
                onChange={(event) => update("bio", event.target.value)}
                rows={4}
                placeholder="Share the admissions topics, student goals, and application moments where you are strongest."
              />
            </Field>

            <Field label="Target schools you know well">
              <input
                value={commaList(answers.targetSchools)}
                onChange={(event) => update("targetSchools", parseCommaList(event.target.value))}
                placeholder="Georgia Tech, Brown, University of Georgia"
              />
            </Field>
          </section>

          <CheckboxGroup label="Where can you help students most?" options={MENTOR_SPECIALTIES} value={answers.specialties} onChange={(value) => update("specialties", value)} />
          <CheckboxGroup label="Which academic areas are a strong fit?" options={MENTOR_TARGET_MAJORS} value={answers.targetMajors} onChange={(value) => update("targetMajors", value)} />
          <CheckboxGroup label="What is your mentoring style?" options={MENTOR_SUPPORT_STYLES} value={answers.supportStyles} onChange={(value) => update("supportStyles", value)} />
          <CheckboxGroup label="Which application strengths should matching consider?" options={MENTOR_APPLICATION_STRENGTHS} value={answers.applicationStrengths} onChange={(value) => update("applicationStrengths", value)} />

          <section className="mentor-onboarding__panel">
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
