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
import { useInteractionFeedback } from "../../../components/interaction/InteractionFeedback.jsx";

// Keeps only schedules confirmed by the dashboard API so route remounts can
// refresh in the background without flashing an empty page.
const confirmedAvailabilityByUser = new Map();

function isMentorAccessDenied(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode || 0);
  const message = String(error.message || "").toLowerCase();
  return status === 403 || message.includes("mentor access required");
}

export default function MentorAvailabilityProduct() {
  const { user, ready: authReady } = useAuth();
  const { showToast } = useInteractionFeedback();
  const { availability, mentorIdentity, saveAvailability, syncStatus, syncError, loading: dashboardLoading } = useDashboardData();
  const cachedSlots = user?.id ? confirmedAvailabilityByUser.get(user.id) : null;
  const [slots, setSlots] = useState(() => (
    cachedSlots || availability.map((slot, index) => normalizeAvailabilitySlot(slot, index))
  ));
  const [form, setForm] = useState(() => slotsToWeeklyFormState(slots));
  const [hasConfirmedAvailability, setHasConfirmedAvailability] = useState(Boolean(cachedSlots));
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const roleResolved = Boolean(authReady);
  const hasMentorProfile = mentorIdentity?.hasProfile === true;
  const refreshing = dashboardLoading || syncStatus === "loading";
  const stillLoading = !authReady || (refreshing && !hasConfirmedAvailability);
  const canDisplayAvailability = hasMentorProfile || (refreshing && hasConfirmedAvailability);

  useEffect(() => {
    if (dashboardLoading || syncStatus === "loading") return;
    if (!mentorIdentity?.hasProfile) {
      if (user?.id) confirmedAvailabilityByUser.delete(user.id);
      setHasConfirmedAvailability(false);
      return;
    }
    const nextSlots = availability.map((slot, index) => normalizeAvailabilitySlot(slot, index));
    setSlots(nextSlots);
    setForm(slotsToWeeklyFormState(nextSlots));
    if (user?.id) confirmedAvailabilityByUser.set(user.id, nextSlots);
    setHasConfirmedAvailability(true);
  }, [availability, dashboardLoading, mentorIdentity?.hasProfile, syncStatus, user?.id]);

  useEffect(() => {
    if (!roleResolved || stillLoading) return;
    if (!canDisplayAvailability) setAccessDenied(true);
  }, [roleResolved, stillLoading, canDisplayAvailability]);

  async function handleSave() {
    const validationError = validateWeeklyFormState(form);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    const nextSlots = weeklyFormStateToSlots(form, slots);
    setSaving(true);
    try {
      await saveAvailability({
        timezone: form.timezone,
        days: form.days
      });
      setSlots(nextSlots);
      if (user?.id) confirmedAvailabilityByUser.set(user.id, nextSlots);
      setHasConfirmedAvailability(true);
      setAccessDenied(false);
      showToast("Availability saved. Assigned students can book these times immediately.");
    } catch (saveError) {
      if (isMentorAccessDenied(saveError)) {
        setAccessDenied(true);
      } else {
        showToast(
          saveError?.message || syncError || "Availability could not be synchronized. Try again.",
          "error"
        );
      }
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

  if (accessDenied || !canDisplayAvailability) {
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
        <MentorAvailabilitySetupCard
          form={form}
          error=""
          success={false}
          saving={saving}
          onChange={(next) => {
            setForm(next);
          }}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
