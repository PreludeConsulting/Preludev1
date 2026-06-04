import { useMemo, useState } from "react";
import { X } from "lucide-react";
import AnswerChip from "./AnswerChip.jsx";

export default function PreludeMatchSchoolSelector({ suggestions, selected, onChange, reducedMotion }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = suggestions.filter((s) => !selected.includes(s));
    if (!q) return pool.slice(0, 3);
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 3);
  }, [query, suggestions, selected]);

  function addSchool(school) {
    if (selected.includes(school)) return;
    onChange([...selected, school]);
    setQuery("");
  }

  return (
    <div className="pm-schools">
      <label className="sr-only" htmlFor="pm-school-search">
        Search schools
      </label>
      <input
        id="pm-school-search"
        type="search"
        className="pm-schools__input"
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
        <ul className="pm-schools__list" role="listbox">
          {filtered.map((school) => (
            <li key={school}>
              <button type="button" className="pm-schools__option" onClick={() => addSchool(school)}>
                {school}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected.length > 0 ? (
        <div className="pm-schools__chips">
          {selected.map((school) => (
            <span key={school} className="pm-schools__chip">
              {school}
              <button
                type="button"
                className="pm-schools__remove"
                onClick={() => onChange(selected.filter((s) => s !== school))}
                aria-label={`Remove ${school}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <AnswerChip
        label="Still exploring"
        selected={selected.length === 1 && selected[0] === "Still exploring"}
        onSelect={() => onChange(["Still exploring"])}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
