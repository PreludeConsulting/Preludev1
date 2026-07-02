import { cn } from "../../lib/utils.js";
import PreludeMentorCard from "../hero/PreludeMentorCard.jsx";
import { getMentorSelectionMode, getSelectionUiCopy } from "../../../shared/mentorSelectionLogic.js";

function SelectableMentorCard({ mentor, selected, selectable, onSelect }) {
  const handleKeyDown = (event) => {
    if (!selectable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(mentor.id);
    }
  };

  return (
    <div
      className={cn(
        "pm-mentor-select-card",
        selectable && "pm-mentor-select-card--selectable",
        selected && "pm-mentor-select-card--selected"
      )}
      role={selectable ? "radio" : undefined}
      aria-checked={selectable ? selected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? () => onSelect?.(mentor.id) : undefined}
      onKeyDown={handleKeyDown}
    >
      {selectable ? (
        <div className="pm-mentor-select-card__selector" aria-hidden="true">
          <span className={cn("pm-mentor-select-card__radio", selected && "pm-mentor-select-card__radio--checked")} />
        </div>
      ) : null}
      <PreludeMentorCard mentor={mentor} showAction={false} />
    </div>
  );
}

export default function MentorMatchSelectionPanel({
  mentors = [],
  matchedMentorCount = 0,
  selectedMentorId = null,
  loading = false,
  selectionComplete = false,
  onSelectMentor,
  onContinue
}) {
  const mode = getMentorSelectionMode(matchedMentorCount);
  const copy = getSelectionUiCopy(mode);
  const selectable = mode === "student_select" && !selectionComplete;
  const continueDisabled = selectable ? !selectedMentorId || loading : loading;

  return (
    <div className="pm-match-result">
      <header className="pm-match-result__head">
        <h2 className="pm-results__title">{copy.heading}</h2>
        <p className="pm-results__sub">{copy.subtext}</p>
      </header>

      {mentors.length ? (
        <div
          className={cn("pm-match-result__grid", selectable && "pm-match-result__grid--selectable")}
          role={selectable ? "radiogroup" : undefined}
          aria-label={selectable ? "Choose your mentor" : "Your mentor matches"}
        >
          {mentors.map((mentor) => (
            <SelectableMentorCard
              key={mentor.id}
              mentor={mentor}
              selected={selectedMentorId === mentor.id}
              selectable={selectable}
              onSelect={onSelectMentor}
            />
          ))}
        </div>
      ) : null}

      {selectionComplete ? (
        <p className="pm-match-result__saved" role="status">
          Your mentor match preferences are saved. Continue to the next onboarding step.
        </p>
      ) : null}

      <div className="pm-match-result__actions">
        <button
          type="button"
          className="dash-btn dash-btn--primary"
          disabled={continueDisabled}
          onClick={onContinue}
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
