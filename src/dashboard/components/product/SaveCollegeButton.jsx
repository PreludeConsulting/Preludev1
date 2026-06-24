import { useState } from "react";
import { Heart } from "lucide-react";
import { usePreludeMotion } from "../../../context/MotionContext.jsx";
import { useInterfaceSound } from "../../../lib/sound/SoundProvider.jsx";
import { cn } from "../../../lib/utils.js";

const HEART_RED = "#e5484d";

/**
 * Save / unsave college control — fully opaque in every state, red heart on hover/saved.
 */
export default function SaveCollegeButton({
  collegeId,
  saved,
  onToggle,
  size = "default",
  className,
  label = "Save College",
  savedLabel = "Saved"
}) {
  const { reducedMotion } = usePreludeMotion();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const [pending, setPending] = useState(null);
  const [savePulse, setSavePulse] = useState(false);
  const [unsavePulse, setUnsavePulse] = useState(false);
  const isSaving = pending === "save";
  const isUnsaving = pending === "unsave";
  const busy = isSaving || isUnsaving;

  const displayLabel = isSaving ? "Saving..." : isUnsaving ? "Removing..." : saved ? savedLabel : label;

  async function handleClick() {
    if (busy) return;
    const wasSaved = saved;
    setPending(wasSaved ? "unsave" : "save");

    try {
      await onToggle(collegeId, wasSaved);
      if (!wasSaved) {
        if (!reducedMotion) {
          setSavePulse(true);
          window.setTimeout(() => setSavePulse(false), 480);
        }
        play(SOUND_EVENTS.HEART);
      } else if (!reducedMotion) {
        setUnsavePulse(true);
        window.setTimeout(() => setUnsavePulse(false), 300);
      }
    } catch {
      /* parent rolls back optimistic state */
    } finally {
      setPending(null);
    }
  }

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      className={cn(
        "dash-college-save-btn",
        size === "sm" && "dash-college-save-btn--sm",
        saved && "dash-college-save-btn--saved",
        busy && "dash-college-save-btn--pending",
        className
      )}
      aria-pressed={saved}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      aria-label={saved ? "Remove saved college" : "Save college"}
      onClick={handleClick}
    >
      {busy ? <span className="dash-college-save-btn__spinner" aria-hidden="true" /> : null}
      <span
        className={cn(
          "dash-college-save-btn__heart-wrap",
          !saved && !busy && "dash-college-save-btn__heart-wrap--hoverable",
          savePulse && "dash-college-save-btn__heart-wrap--save-pulse",
          unsavePulse && "dash-college-save-btn__heart-wrap--unsave-pulse"
        )}
        aria-hidden="true"
      >
        <Heart
          className={cn(
            "dash-college-save-btn__heart",
            iconSize,
            saved && "dash-college-save-btn__heart--filled"
          )}
          fill={saved ? HEART_RED : "none"}
          stroke={saved ? HEART_RED : "currentColor"}
          strokeWidth={2}
        />
      </span>
      <span className="dash-college-save-btn__label">{displayLabel}</span>
    </button>
  );
}
