import { useMemo, useState } from "react";
import { X } from "lucide-react";
import AnswerChip from "./AnswerChip.jsx";

export default function SchoolAutocomplete({
  suggestions,
  selected,
  onChange,
  reducedMotion
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestions.filter((s) => !selected.includes(s)).slice(0, 6);
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !selected.includes(s))
      .slice(0, 6);
  }, [query, suggestions, selected]);

  function addSchool(school) {
    if (selected.includes(school)) return;
    onChange([...selected, school]);
    setQuery("");
  }

  function removeSchool(school) {
    onChange(selected.filter((s) => s !== school));
  }

  return (
    <div className="hero-mm-schools">
      <label className="sr-only" htmlFor="hero-school-search">
        Search schools
      </label>
      <input
        id="hero-school-search"
        type="search"
        className="hero-mm-schools__input"
        placeholder="Search schools…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered[0]) {
            e.preventDefault();
            addSchool(filtered[0]);
          }
        }}
        autoComplete="off"
      />

      {filtered.length > 0 ? (
        <ul className="hero-mm-schools__suggestions" role="listbox">
          {filtered.map((school) => (
            <li key={school}>
              <button type="button" className="hero-mm-schools__suggestion" onClick={() => addSchool(school)}>
                {school}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="hero-mm-schools__chips">
        {selected.map((school) => (
          <span key={school} className="hero-mm-schools__chip">
            {school}
            <button
              type="button"
              className="hero-mm-schools__chip-remove"
              onClick={() => removeSchool(school)}
              aria-label={`Remove ${school}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <AnswerChip
        label="Still exploring"
        selected={selected.length === 1 && selected[0] === "Still exploring"}
        onSelect={() => onChange(["Still exploring"])}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
