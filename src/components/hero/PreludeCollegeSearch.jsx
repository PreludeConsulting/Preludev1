import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import AnswerChip from "./AnswerChip.jsx";
import {
  collegeKey,
  formatCollegeLocation,
  isCollegeSelected,
  searchColleges
} from "../../lib/collegeSearch.js";

export default function PreludeCollegeSearch({ selected, onChange, reducedMotion }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const debounceRef = useRef(null);
  const listId = "pm-college-results";

  const runSearch = useCallback(
    async (term, signal) => {
      if (term.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const rows = await searchColleges(term, { limit: 20, signal });
      setResults(rows.filter((c) => !isCollegeSelected(selected, c)));
      setLoading(false);
    },
    [selected]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const controller = new AbortController();
    debounceRef.current = setTimeout(() => {
      runSearch(query, controller.signal);
    }, 250);
    return () => {
      clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query, runSearch]);

  function addCollege(college) {
    if (isCollegeSelected(selected, college)) return;
    const cleaned = selected.filter((s) =>
      typeof s === "string" ? s !== "Still exploring" : s.name !== "Still exploring"
    );
    onChange([...cleaned, college]);
    setQuery("");
    setOpen(false);
    setFocusIndex(-1);
  }

  function removeCollege(item) {
    const key = typeof item === "string" ? item : collegeKey(item);
    onChange(
      selected.filter((s) => {
        if (typeof s === "string") return s !== key && s !== item;
        return collegeKey(s) !== key;
      })
    );
  }

  function selectStillExploring() {
    onChange(["Still exploring"]);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      setOpen(false);
      setFocusIndex(-1);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      addCollege(results[focusIndex]);
    }
  }

  return (
    <div className="pm-colleges">
      <label className="pm-colleges__label" htmlFor="pm-college-search">
        Search U.S. colleges and universities
      </label>
      <input
        id="pm-college-search"
        type="search"
        className="pm-colleges__input"
        placeholder="Start typing a school name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setFocusIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && query.trim().length >= 2}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
      />

      <p className="sr-only" aria-live="polite">
        {loading ? "Searching colleges and universities…" : results.length ? `${results.length} schools found` : ""}
      </p>

      {open && query.trim().length >= 2 ? (
        <ul id={listId} className="pm-colleges__dropdown" role="listbox">
          {loading ? (
            <li className="pm-colleges__empty">Searching…</li>
          ) : results.length === 0 ? (
            <li className="pm-colleges__empty">No schools found. Try a different name.</li>
          ) : (
            results.map((college, i) => (
              <li key={collegeKey(college)} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={focusIndex === i}
                  className={`pm-colleges__option${focusIndex === i ? " pm-colleges__option--active" : ""}`}
                  onMouseEnter={() => setFocusIndex(i)}
                  onClick={() => addCollege(college)}
                >
                  <span className="pm-colleges__name">{college.name}</span>
                  <span className="pm-colleges__location">{formatCollegeLocation(college)}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {selected.length > 0 ? (
        <div className="pm-colleges__chips">
          {selected.map((item) => {
            const label = typeof item === "string" ? item : item.name;
            const key = typeof item === "string" ? item : collegeKey(item);
            return (
              <span key={key} className="pm-colleges__chip">
                {label}
                <button
                  type="button"
                  className="pm-colleges__remove"
                  onClick={() => removeCollege(item)}
                  aria-label={`Remove ${label}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <AnswerChip
        label="Still exploring"
        selected={selected.length === 1 && selected[0] === "Still exploring"}
        onSelect={selectStillExploring}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
