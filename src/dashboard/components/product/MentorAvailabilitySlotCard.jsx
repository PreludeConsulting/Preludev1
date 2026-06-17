import { Repeat } from "lucide-react";
import { SecondaryButton } from "../ui/index.jsx";

export default function MentorAvailabilitySlotCard({ slot, onEdit, onDelete }) {
  return (
    <article className="dash-mentor-availability-card">
      <header className="dash-mentor-availability-card__head">
        <h3 className="dash-mentor-availability-card__day">{slot.day}</h3>
        {slot.recurring !== false ? (
          <span className="dash-mentor-availability-card__recurring">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Weekly recurring
          </span>
        ) : null}
      </header>

      <p className="dash-mentor-availability-card__time">{slot.time}</p>

      <div className="dash-mentor-availability-card__actions">
        <SecondaryButton type="button" className="dash-btn--sm" onClick={() => onEdit(slot)}>
          Edit
        </SecondaryButton>
        <button type="button" className="dash-link-btn dash-mentor-availability-card__delete" onClick={() => onDelete(slot)}>
          Delete
        </button>
      </div>
    </article>
  );
}
