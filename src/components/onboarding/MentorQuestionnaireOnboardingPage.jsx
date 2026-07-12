import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  EMPTY_MENTOR_PROFILE_FORM,
  MentorProfileFormFields,
  mentorProfileFormFromData,
  normalizeMentorProfilePayload,
  validateMentorProfileForm
} from "../../dashboard/components/mentor/mentorProfileFormShared.jsx";
import MentorAvailabilitySetupCard from "../../dashboard/components/product/MentorAvailabilitySetupCard.jsx";
import { SectionCard } from "../../dashboard/components/ui/index.jsx";
import {
  DEFAULT_WEEKLY_FORM,
  formatWeeklyAvailabilitySummary,
  scheduleToWeeklyFormState,
  validateWeeklyFormState
} from "../../dashboard/lib/mentorAvailability.js";
import { updateMentorAvailability } from "../../lib/dashboardApi.js";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import {
  dashboardPathForRole,
  MENTOR_ONBOARDING_PATH,
  ROLE_SELECTION_PATH,
  userNeedsMentorOnboarding
} from "../../lib/onboardingRoutes.js";
import { loadMentorQuestionnaire, saveMentorQuestionnaire } from "../../lib/mentorQuestionnaireService.js";
import AppLink from "../AppLink.jsx";

export default function MentorQuestionnaireOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_MENTOR_PROFILE_FORM);
  const [availabilityForm, setAvailabilityForm] = useState(() => ({
    timezone: DEFAULT_WEEKLY_FORM.timezone,
    days: DEFAULT_WEEKLY_FORM.days.map((day) => ({ ...day }))
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function loadExisting() {
      if (!user?.id || user.authProvider !== "supabase") {
        setLoading(false);
        return;
      }
      const { questionnaire, matchingProfile } = await loadMentorQuestionnaire(user.id);
      if (cancelled) return;
      setForm(mentorProfileFormFromData(questionnaire, matchingProfile));
      setAvailabilityForm(scheduleToWeeklyFormState(matchingProfile?.availability_schedule));
      setLoading(false);
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.authProvider]);

  if (!ready || loading) {
    return (
      <main className="pm-onboarding-page mentor-onboarding mentor-onboarding--profile">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
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

  function showError(message) {
    setError(message);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function handleContinueToAvailability(event) {
    event.preventDefault();
    setError("");
    const nextErrors = validateMentorProfileForm(form, { requireAvailabilityNotes: false });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showError("Complete the highlighted mentor profile fields before continuing.");
      return;
    }

    setSaving(true);
    try {
      const payload = normalizeMentorProfilePayload(form);
      const { error: saveError } = await saveMentorQuestionnaire(user, payload, { markComplete: false });
      if (saveError) throw new Error(saveError);
      setForm(payload);
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      showError(err.message || "Could not save your mentor profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteOnboarding(event) {
    event.preventDefault();
    setError("");
    const validationError = validateWeeklyFormState(availabilityForm);
    if (validationError) {
      showError(validationError);
      return;
    }

    setSaving(true);
    try {
      const scheduleSummary = formatWeeklyAvailabilitySummary(availabilityForm);
      const notes = form.availability?.trim() || "";
      const availabilityText = notes
        ? notes.includes(scheduleSummary)
          ? notes
          : `${notes} · ${scheduleSummary}`
        : scheduleSummary;

      const profilePayload = normalizeMentorProfilePayload({
        ...form,
        availability: availabilityText
      });

      await updateMentorAvailability({
        timezone: availabilityForm.timezone,
        days: availabilityForm.days
      });

      const { error: saveError, completed } = await saveMentorQuestionnaire(user, profilePayload, {
        markComplete: true
      });
      if (saveError) throw new Error(saveError);
      if (!completed) throw new Error("Complete all required mentor profile fields before finishing.");

      await refreshUser();
      navigate(dashboardPathForRole(user.role), { replace: true });
    } catch (err) {
      showError(err.message || "Could not complete mentor onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="pm-onboarding-page mentor-onboarding mentor-onboarding--profile">
      <div className="pm-onboarding-page__inner mentor-onboarding__inner mentor-onboarding__inner--wide">
        {step === 1 ? (
          <AppLink href={ROLE_SELECTION_PATH} className="pm-onboarding-page__back">
            ← Back to role selection
          </AppLink>
        ) : (
          <button
            type="button"
            className="pm-onboarding-page__back"
            onClick={() => {
              setError("");
              setStep(1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            ← Back to profile
          </button>
        )}

        {error ? (
          <div ref={errorRef} className="plan-select-page__error" role="alert" tabIndex={-1}>
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handleContinueToAvailability}>
            <SectionCard title="Mentor profile" className="dash-panel">
              <MentorProfileFormFields
                form={form}
                errors={errors}
                onChange={(next) => {
                  setForm(next);
                  setErrors({});
                }}
              />
              <div className="dash-form-actions mentor-onboarding__actions">
                <button type="submit" className="dash-btn dash-btn--primary" disabled={saving}>
                  {saving ? "Saving…" : "Continue to availability"}
                </button>
              </div>
            </SectionCard>
          </form>
        ) : (
          <div className="dash-page dash-page--mentor-availability mentor-onboarding__availability">
            <header className="dash-mentor-avail-page-head" aria-labelledby="mentor-onboarding-availability-heading">
              <span className="dash-mentor-avail-page-head__icon" aria-hidden="true">
                <Calendar className="h-7 w-7" />
              </span>
              <div>
                <h1 id="mentor-onboarding-availability-heading" className="dash-mentor-avail-page-head__title">
                  Set your availability
                </h1>
                <p className="dash-mentor-avail-page-head__subtitle">
                  Let Prelude know when you&apos;re typically available for students to book meetings.
                </p>
              </div>
            </header>

            <div className="dash-mentor-avail-setup-card-wrap">
              <MentorAvailabilitySetupCard
                form={availabilityForm}
                error=""
                success={false}
                showSaveButton={false}
                onChange={(next) => {
                  setAvailabilityForm(next);
                  setError("");
                }}
                onSave={() => {}}
              />
              <div className="dash-form-actions mentor-onboarding__actions mentor-onboarding__actions--split">
                <button
                  type="button"
                  className="dash-btn dash-btn--secondary"
                  disabled={saving}
                  onClick={() => {
                    setError("");
                    setStep(1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Back to profile
                </button>
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
                  disabled={saving}
                  onClick={handleCompleteOnboarding}
                >
                  {saving ? "Saving…" : "Complete mentor onboarding"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
