import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import AnswerChip from "./AnswerChip.jsx";
import {
  EXPLORE_COLLEGES,
  STILL_EXPLORING_LABEL,
  formatExploreCollegeLocation,
  isStillExploringSelection,
  matchCollegeSelectionsEqual,
  normalizeMatchCollegeAnswers,
  searchExploreColleges,
  toMatchCollegeSelection
} from "../../dashboard/data/collegeExploreData.js";

const MAX_VISIBLE_RESULTS = 8;

export default function PreludeCollegeSearch({ selected, onChange, reducedMotion }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();
  const inputId = useId();

  const stillExploring = isStillExploringSelection(selected);
  const colleges = useMemo(
    () => (stillExploring ? [] : normalizeMatchCollegeAnswers(selected)),
    [selected, stillExploring]
  );
  const selectedIds = useMemo(() => colleges.map((college) => college.id), [colleges]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchExploreColleges(query, {
      limit: 20,
      excludeIds: selectedIds
    });
  }, [query, selectedIds]);

  const showDropdown = open && query.trim().length > 0;

  useEffect(() => {
    if (!Array.isArray(selected) || selected.length === 0) return;
    if (stillExploring) {
      if (selected[0] !== STILL_EXPLORING_LABEL) onChange([STILL_EXPLORING_LABEL]);
      return;
    }
    const normalized = normalizeMatchCollegeAnswers(selected);
    if (!matchCollegeSelectionsEqual(selected, normalized)) {
      onChange(normalized);
    }
  }, [selected, stillExploring, onChange]);

  useEffect(() => {
    if (!showDropdown) return undefined;
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setFocusIndex(-1);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDropdown]);

  function addCollege(school) {
    const selection = toMatchCollegeSelection(school);
    if (!selection) return;
    if (selectedIds.includes(selection.id)) return;
    onChange([...colleges, selection]);
    setQuery("");
    setOpen(false);
    setFocusIndex(-1);
    inputRef.current?.focus();
  }

  function removeCollege(college) {
    onChange(colleges.filter((item) => item.id !== college.id));
    inputRef.current?.focus();
  }

  function selectStillExploring() {
    onChange([STILL_EXPLORING_LABEL]);
    setQuery("");
    setOpen(false);
    setFocusIndex(-1);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      setFocusIndex(-1);
      return;
    }

    if (!showDropdown) {
      if (event.key === "ArrowDown" && query.trim()) {
        setOpen(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      if (results.length === 0) return;
      event.preventDefault();
      setFocusIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      setFocusIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (focusIndex >= 0 && results[focusIndex]) {
        event.preventDefault();
        addCollege(results[focusIndex]);
      }
    }
  }

  return (
    <div className="pm-colleges" ref={rootRef}>
      <label className="pm-colleges__label" htmlFor={inputId}>
        Search U.S. colleges and universities
      </label>

      <div className="pm-colleges__field">
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          className="pm-colleges__input"
          placeholder="Search colleges..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setFocusIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            focusIndex >= 0 && results[focusIndex] ? `${listId}-option-${results[focusIndex].id}` : undefined
          }
          autoComplete="off"
        />

        {showDropdown ? (
          <ul id={listId} className="pm-colleges__dropdown" role="listbox" aria-label="College search results">
            {results.length === 0 ? (
              <li className="pm-colleges__empty" role="presentation">
                No colleges found.
              </li>
            ) : (
              results.map((college, index) => (
                <li key={college.id} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-option-${college.id}`}
                    role="option"
                    aria-selected={focusIndex === index}
                    className={`pm-colleges__option${focusIndex === index ? " pm-colleges__option--active" : ""}`}
                    onMouseEnter={() => setFocusIndex(index)}
                    onClick={() => addCollege(college)}
                  >
                    <span className="pm-colleges__name">{college.name}</span>
                    <span className="pm-colleges__location">{formatExploreCollegeLocation(college)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {showDropdown
          ? results.length
            ? `${results.length} colleges found`
            : "No colleges found."
          : ""}
      </p>

      {colleges.length > 0 ? (
        <ul className="pm-colleges__chips" aria-label="Selected colleges">
          {colleges.map((college) => (
            <li key={college.id} className="pm-colleges__chip">
              <span className="pm-colleges__chip-label">{college.name}</span>
              <button
                type="button"
                className="pm-colleges__remove"
                onClick={() => removeCollege(college)}
                aria-label={`Remove ${college.name}`}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <AnswerChip
        label={STILL_EXPLORING_LABEL}
        selected={stillExploring}
        onSelect={selectStillExploring}
        reducedMotion={reducedMotion}
      />

      <span className="sr-only">
        Searching {EXPLORE_COLLEGES.length} colleges from the shared Explore Colleges list.
        Showing up to {MAX_VISIBLE_RESULTS} results before scrolling.
      </span>
    </div>
  );
}
