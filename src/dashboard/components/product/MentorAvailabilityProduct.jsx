import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  normalizeAvailabilitySlot,
  slotsToWeeklyFormState,
  validateWeeklyFormState,
  weeklyFormStateToSlots
} from "../../lib/mentorAvailability.js";
import MentorAvailabilitySetupCard from "./MentorAvailabilitySetupCard.jsx";

function isMentorAccessDenied(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  const message = String(error.message || "").toLowerCase();
  return status === 403 || message.includes("mentor access required");
}

export default function MentorAvailabilityProduct() {
  const { user, ready: authReady } = useAuth();
  const { availability, mentorIdentity, saveAvailability, syncStatus, syncError, loading: dashboardLoading } = useDashboardData();
  const [slots, setSlots] = useState(() => availability.map((slot, index) => normalizeAvailabilitySlot(slot, index)));
  const [form, setForm] = useState(() => slotsToWeeklyFormState(slots));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const roleResolved = Boolean(authReady);
  const hasMentorProfile = mentorIdentity?.hasProfile === true;
  const stillLoading = !authReady || dashboardLoading || syncStatus === "loading";

  useEffect(() => {
    const nextSlots = availability.map((slot, index) => normalizeAvailabilitySlot(slot, index));
    setSlots(nextSlots);
    setForm(slotsToWeeklyFormState(nextSlots));
  }, [availability]);

  useEffect(() => {
    if (!roleResolved || stillLoading) return;
    if (!hasMentorProfile) setAccessDenied(true);
  }, [roleResolved, stillLoading, hasMentorProfile]);

  async function handleSave() {
    const validationError = validateWeeklyFormState(form);
    if (validationError) {
      setError(validationError);
      setSuccess(false);
      return;
    }

    const nextSlots = weeklyFormStateToSlots(form, slots);
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await saveAvailability({
        timezone: form.timezone,
        days: form.days
      });
      setSlots(nextSlots);
      setAccessDenied(false);
      setSuccess(true);
    } catch (saveError) {
      if (isMentorAccessDenied(saveError)) {
        setAccessDenied(true);
        setError("");
      } else {
        setError(saveError?.message || syncError || "Availability could not be synchronized. Try again.");
      }
      setSuccess(false);
    } finally {
      setSaving(false);
    }
  }

  if (stillLoading || !roleResolved) {
    return (
      <div className="dash-page dash-page--mentor-availability">
        <p className="dash-muted" role="status">Loading availability…</p>
      </div>
    );
  }

  if (accessDenied || !hasMentorProfile) {
    return (
      <div className="dash-page dash-page--mentor-availability">
        <header className="dash-mentor-avail-page-head" aria-labelledby="mentor-availability-setup-heading">
          <span className="dash-mentor-avail-page-head__icon" aria-hidden="true">
            <Calendar className="h-7 w-7" />
          </span>
          <div>
            <h1 id="mentor-availability-setup-heading" className="dash-mentor-avail-page-head__title">
              Set your availability
            </h1>
          </div>
        </header>
        <p className="dash-mentor-avail-setup__error" role="alert">
          No mentor profile is associated with this account.
        </p>
      </div>
    );
  }

  return (
    <div className="dash-page dash-page--mentor-availability">
      <header className="dash-mentor-avail-page-head" aria-labelledby="mentor-availability-setup-heading">
        <span className="dash-mentor-avail-page-head__icon" aria-hidden="true">
          <Calendar className="h-7 w-7" />
        </span>
        <div>
          <h1 id="mentor-availability-setup-heading" className="dash-mentor-avail-page-head__title">
            Set your availability
          </h1>
          <p className="dash-mentor-avail-page-head__subtitle">
            Let Prelude know when you&apos;re typically available for students to book meetings.
          </p>
        </div>
      </header>

      <div className="dash-mentor-avail-setup-card-wrap">
        {syncStatus === "offline" ? <p className="dash-mentor-avail-setup__error" role="alert">You are offline. Reconnect and retry your save.</p> : null}
        {error ? <p className="dash-mentor-avail-setup__error" role="alert">{error}</p> : null}
        {success ? (
          <p className="dash-mentor-avail-setup__success" role="status">
            Availability saved. Assigned students can book these times immediately.
          </p>
        ) : null}
        <MentorAvailabilitySetupCard
          form={form}
          error=""
          success={success}
          saving={saving}
          onChange={(next) => {
            setForm(next);
            setError("");
            setSuccess(false);
          }}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
