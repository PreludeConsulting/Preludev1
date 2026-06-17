import { useState } from "react";
import { Calendar } from "lucide-react";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  normalizeAvailabilitySlot,
  slotsToWeeklyFormState,
  validateWeeklyFormState,
  weeklyFormStateToSlots
} from "../../lib/mentorAvailability.js";
import MentorAvailabilitySetupCard from "./MentorAvailabilitySetupCard.jsx";

export default function MentorAvailabilityProduct() {
  const { availability } = useDashboardData();
  const [slots, setSlots] = useState(() => availability.map((slot, index) => normalizeAvailabilitySlot(slot, index)));
  const [form, setForm] = useState(() => slotsToWeeklyFormState(slots));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function handleSave() {
    const validationError = validateWeeklyFormState(form);
    if (validationError) {
      setError(validationError);
      setSuccess(false);
      return;
    }

    const nextSlots = weeklyFormStateToSlots(form, slots);
    setSlots(nextSlots);
    setError("");
    setSuccess(true);
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
          error={error}
          success={success}
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
