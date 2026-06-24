import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  MapPin,
  Sparkles,
  X
} from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { getCollegeCampusFallback } from "../../data/collegeCampusImages.js";
import {
  COLLEGE_FILTER_GROUPS,
  EXPLORE_COLLEGES,
  FILTER_OPTION_SETS,
  SORT_OPTIONS,
  collegeById,
  filterColleges,
  formatAcceptance,
  formatEnrollment,
  formatGraduation,
  formatSatRange,
  formatTuition
} from "../../data/collegeExploreData.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { SearchInput } from "../ui/index.jsx";
import CollegeAIMatchModal from "./CollegeAIMatchModal.jsx";
import SaveCollegeButton from "./SaveCollegeButton.jsx";
import PreludeConstellation from "./PreludeConstellation.jsx";

function activeFilterCount(filters) {
  return Object.values(filters).reduce((sum, values) => sum + (values?.length || 0), 0);
}

export default function CollegesExplore() {
  const { savedColleges: persistedColleges, updateSavedColleges } = useDashboardData();
  const [savedColleges, setSavedColleges] = useState(persistedColleges ?? []);
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);
  const [sortBy, setSortBy] = useState("ranking");
  const [searchQuery, setSearchQuery] = useState("");
  const [majorSearchQuery, setMajorSearchQuery] = useState("");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [constellationActive, setConstellationActive] = useState(false);
  const filterBarRef = useRef(null);
  const exploreRef = useRef(null);
  const listRef = useRef(null);

  const savedIds = useMemo(() => savedColleges.map((entry) => entry.collegeId), [savedColleges]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const filteredColleges = useMemo(() => {
    const filtered = filterColleges(EXPLORE_COLLEGES, filters, searchQuery);
    return sortCollegesLocal(filtered, sortBy);
  }, [filters, searchQuery, sortBy]);

  const savedEntries = useMemo(
    () =>
      savedColleges
        .map((entry) => {
          const school = collegeById(entry.collegeId);
          return school ? { ...entry, school } : null;
        })
        .filter(Boolean),
    [savedColleges]
  );

  useEffect(() => {
    setSavedColleges(persistedColleges ?? []);
  }, [persistedColleges]);

  useEffect(() => {
    if (!openFilter) {
      setMajorSearchQuery("");
    }
  }, [openFilter]);

  useEffect(() => {
    if (!openFilter) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") setOpenFilter(null);
    }

    function onPointerDown(event) {
      if (!filterBarRef.current?.contains(event.target)) {
        setOpenFilter(null);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openFilter]);

  function sortCollegesLocal(colleges, sortId) {
    const list = [...colleges];
    switch (sortId) {
      case "acceptance":
        return list.sort((a, b) => a.acceptanceRate - b.acceptanceRate);
      case "tuition":
        return list.sort((a, b) => a.tuition - b.tuition);
      case "graduation":
        return list.sort((a, b) => b.graduationRate - a.graduationRate);
      case "alpha":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "ranking":
      default:
        return list.sort((a, b) => a.rank - b.rank);
    }
  }

  function toggleFilterValue(groupId, optionId) {
    setFilters((prev) => {
      const current = prev[groupId] || [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [groupId]: next };
    });
  }

  function clearFilterGroup(groupId) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }

  function clearAllFilters() {
    setFilters({});
    setOpenFilter(null);
  }

  async function toggleSave(collegeId, currentlySaved) {
    const prev = savedColleges;
    const next = currentlySaved
      ? prev.filter((entry) => entry.collegeId !== collegeId)
      : [...prev, { collegeId }];
    setSavedColleges(next);
    try {
      await updateSavedColleges(next);
      if (!currentlySaved) {
        setConstellationActive(true);
        window.setTimeout(() => setConstellationActive(false), 700);
      }
    } catch (error) {
      setSavedColleges(prev);
      throw error;
    }
  }

  async function removeFromList(collegeId) {
    await toggleSave(collegeId, true);
  }

  function openFilterGroup(groupId) {
    setOpenFilter((current) => {
      const next = current === groupId ? null : groupId;
      if (next !== "majors") setMajorSearchQuery("");
      return next;
    });
  }

  function scrollToExplore() {
    exploreRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalFilters = activeFilterCount(filters);

  return (
    <div className="dash-colleges-explore">
      <section className="dash-colleges-my-list" ref={listRef}>
        <div className="dash-colleges-my-list__head">
          <div>
            <h2 className="dash-colleges-section__title">My College List</h2>
            <p className="dash-colleges-section__sub">
              {savedColleges.length} saved {savedColleges.length === 1 ? "school" : "schools"}
            </p>
          </div>
          <button type="button" className="dash-colleges-link-btn" onClick={scrollToExplore}>
            View Full List →
          </button>
        </div>
        <PreludeConstellation
          variant="colleges"
          value={savedColleges.length}
          total={Math.max(6, savedColleges.length)}
          active={constellationActive}
          compact
          label={`${savedColleges.length} colleges saved to your college atlas`}
        />
        <div className="dash-colleges-my-list__grid">
          {savedEntries.length ? (
            savedEntries.map(({ collegeId, school }) => (
              <article key={collegeId} className="dash-colleges-my-list__card">
                <p className="dash-colleges-my-list__name">{school.shortName || school.name}</p>
                <button
                  type="button"
                  className="dash-colleges-my-list__remove"
                  aria-label={`Remove ${school.shortName || school.name} from your list`}
                  onClick={() => removeFromList(collegeId)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </article>
            ))
          ) : (
            <p className="dash-colleges-empty-hint">Save colleges below to build your list.</p>
          )}
        </div>
      </section>

      <section className="dash-colleges-explore-section" ref={exploreRef}>
        <header className="dash-colleges-explore__header">
          <h2 className="dash-colleges-explore__title">Explore Colleges</h2>
          <p className="dash-colleges-explore__subtitle">
            Find schools that match your academic goals, interests, and budget.
          </p>
        </header>

        <div className="dash-colleges-toolbar">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search colleges…"
          />
          <label className="dash-colleges-sort">
            <span>Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort colleges">
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </label>
        </div>

        <div className="dash-colleges-filters" ref={filterBarRef}>
          <div className="dash-colleges-filters__chips">
            {COLLEGE_FILTER_GROUPS.map((group) => {
              const count = filters[group.id]?.length || 0;
              return (
                <div key={group.id} className="dash-colleges-filters__chip-wrap">
                  <button
                    type="button"
                    className={cn(
                      "dash-colleges-filters__chip",
                      (openFilter === group.id || count > 0) && "dash-colleges-filters__chip--active"
                    )}
                    aria-expanded={openFilter === group.id}
                    onClick={() => openFilterGroup(group.id)}
                  >
                    {group.label}
                    {count > 0 ? <span className="dash-colleges-filters__count">{count}</span> : null}
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {openFilter === group.id ? (
                    <div
                      className={cn(
                        "dash-colleges-filters__panel",
                        group.id === "majors" && "dash-colleges-filters__panel--majors"
                      )}
                      role="listbox"
                      aria-label={`${group.label} filters`}
                    >
                      <div className="dash-colleges-filters__panel-head">
                        <strong>{group.label}</strong>
                        {count > 0 ? (
                          <button type="button" className="dash-colleges-link-btn" onClick={() => clearFilterGroup(group.id)}>
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {group.id === "majors" ? (
                        <div className="dash-colleges-filters__search">
                          <SearchInput
                            value={majorSearchQuery}
                            onChange={(e) => setMajorSearchQuery(e.target.value)}
                            placeholder="Search majors…"
                          />
                        </div>
                      ) : null}
                      <div className="dash-colleges-filters__options">
                        {(FILTER_OPTION_SETS[group.id] || [])
                          .filter((option) => {
                            if (group.id !== "majors" || !majorSearchQuery.trim()) return true;
                            return option.label.toLowerCase().includes(majorSearchQuery.trim().toLowerCase());
                          })
                          .map((option) => {
                          const selected = filters[group.id]?.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={cn(
                                "dash-colleges-filters__option",
                                selected && "dash-colleges-filters__option--selected"
                              )}
                              onClick={() => toggleFilterValue(group.id, option.id)}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          {totalFilters > 0 ? (
            <button type="button" className="dash-colleges-filters__clear" onClick={clearAllFilters}>
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          ) : null}
        </div>

        <div className="dash-colleges-ai-card">
          <div className="dash-colleges-ai-card__icon" aria-hidden="true">
            <Bot className="h-5 w-5" />
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="dash-colleges-ai-card__copy">
            <h3>Find your best-fit colleges with Prelude AI</h3>
            <p>
              Prelude AI uses your grades, interests, activities, goals, and budget to recommend colleges that fit your profile.
            </p>
          </div>
          <button type="button" className="dash-colleges-ai-card__cta" onClick={() => setAiModalOpen(true)}>
            Match with Prelude →
          </button>
        </div>

        <p className="dash-colleges-results-meta">
          Showing {filteredColleges.length} {filteredColleges.length === 1 ? "college" : "colleges"}
        </p>

        <div className="dash-colleges-results">
          {filteredColleges.map((school) => {
            const saved = savedSet.has(school.id);
            return (
              <article key={school.id} className="dash-college-card">
                <div className="dash-college-card__content">
                  <div className="dash-college-card__rank">#{school.rank}</div>
                  <h3 className="dash-college-card__name">{school.name}</h3>
                  <p className="dash-college-card__location">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {school.location}
                  </p>
                  <ul className="dash-college-card__stats">
                    <li>{school.type}</li>
                    <li>{formatAcceptance(school.acceptanceRate)}</li>
                    <li>{formatGraduation(school.graduationRate)}</li>
                    <li>{formatTuition(school.tuition)} Tuition</li>
                    <li>{formatSatRange(school.satMin, school.satMax)}</li>
                    <li>{formatEnrollment(school.enrollment)}</li>
                  </ul>
                </div>
                <div className="dash-college-card__visual">
                  <img
                    src={school.image}
                    alt={`${school.name} campus`}
                    className="dash-college-card__image"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      const fallback = getCollegeCampusFallback(school.rank);
                      if (img.dataset.fallbackApplied === "1" || img.src === fallback) return;
                      img.dataset.fallbackApplied = "1";
                      img.src = fallback;
                    }}
                  />
                  <SaveCollegeButton
                    collegeId={school.id}
                    saved={saved}
                    onToggle={toggleSave}
                  />
                </div>
              </article>
            );
          })}
        </div>

        {filteredColleges.length === 0 ? (
          <p className="dash-colleges-empty-hint">No colleges match your filters. Try adjusting your search.</p>
        ) : null}
      </section>

      <CollegeAIMatchModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onSaveCollege={(collegeId) => toggleSave(collegeId, savedSet.has(collegeId))}
        savedIds={savedIds}
      />
    </div>
  );
}
