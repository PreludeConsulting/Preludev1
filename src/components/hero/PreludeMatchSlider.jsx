const STRUCTURE_DESCRIPTIONS = {
  1: "Very flexible",
  2: "Mostly flexible",
  3: "Balanced",
  4: "Structured",
  5: "Highly structured"
};

export default function PreludeMatchSlider({ value, min, max, lowLabel, highLabel, onChange }) {
  const description = STRUCTURE_DESCRIPTIONS[value] ?? "Balanced";

  return (
    <div className="pm-scale">
      <input
        type="range"
        className="pm-scale__input"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={`Structure preference: ${description}`}
      />
      <div className="pm-scale__labels">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <p className="pm-scale__description" aria-live="polite">
        {description}
      </p>
    </div>
  );
}
