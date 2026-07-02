import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, UserCheck } from "lucide-react";
import { PRELUDE_MATCH_QUESTIONS } from "../../../data/preludeMatchQuestions.js";
import {
  assignMentorAsMatchingTeam,
  loadMatchingTeamQueue,
  removeMentorAsMatchingTeam
} from "../../../lib/mentorSelectionApi.js";

const QUESTION_LABELS = Object.fromEntries(PRELUDE_MATCH_QUESTIONS.map((question) => [question.id, question.question]));

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function displayList(value, fallback = "Not provided") {
  const items = asArray(value);
  if (!items.length) return fallback;
  return items.map((item) => (typeof item === "string" ? item : item?.name || item?.label || String(item))).join(", ");
}

function statusLabel(status) {
  if (status === "matched") return "Matched";
  if (status === "needs_review") return "Needs Review";
  return "Unmatched";
}

function statusClass(status) {
  if (status === "matched") return "matching-team-status--matched";
  if (status === "needs_review") return "matching-team-status--review";
  return "matching-team-status--unmatched";
}

function studentSummary(student) {
  const answers = student.questionnaireAnswers || {};
  return {
    grade: answers.grade || "Not provided",
    interests: asArray(answers.academicInterests),
    goals: [...asArray(answers.colleges), ...asArray(answers.schoolSpecificSupport)],
    needs: [...asArray(answers.helpAreas), ...asArray(answers.essayStage), ...asArray(answers.accomplishFirst)],
    traits: [...asArray(answers.mentorQualities), ...asArray(answers.backgroundPreference)],
    availability: answers.deadlineTiming || displayList(answers.accountabilityNeeds, "Not provided"),
    notes: [answers.biggestQuestion, answers.backgroundPreference].filter(Boolean).join(" ")
  };
}

function uniqueOptions(students, getter) {
  return [...new Set(students.flatMap((student) => asArray(getter(student))).filter(Boolean))].sort();
}

function StudentField({ label, value }) {
  return (
    <div className="matching-team-field">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function MentorPillList({ items }) {
  const values = asArray(items).slice(0, 4);
  if (!values.length) return null;
  return (
    <div className="matching-team-mentor-card__pills">
      {values.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function MentorCard({ mentor, selected, saving, onAssign }) {
  return (
    <article className={`matching-team-mentor-card${selected ? " matching-team-mentor-card--selected" : ""}`}>
      <div className="matching-team-mentor-card__head">
        <div className="matching-team-mentor-card__avatar">{mentor.initials || "M"}</div>
        <div>
          <h4>{mentor.name}</h4>
          <p>{mentor.school} · {mentor.major}</p>
        </div>
      </div>
      {mentor.bio ? <p className="matching-team-mentor-card__bio">{mentor.bio}</p> : null}
      <dl className="matching-team-mentor-card__facts">
        <div><dt>Strengths</dt><dd>{displayList(mentor.applicationStrengths || mentor.specialties)}</dd></div>
        <div><dt>Style</dt><dd>{displayList(mentor.supportStyles)}</dd></div>
        <div><dt>Targets</dt><dd>{displayList(mentor.targetMajors)}</dd></div>
        <div><dt>Availability</dt><dd>{mentor.availability || "Not provided"}</dd></div>
      </dl>
      <MentorPillList items={[...(mentor.specialties || []), ...(mentor.targetSchools || [])]} />
      <button
        type="button"
        className={selected ? "dash-btn dash-btn--secondary dash-btn--sm" : "dash-btn dash-btn--primary dash-btn--sm"}
        disabled={saving || selected}
        onClick={() => onAssign(mentor.id)}
      >
        {selected ? "Assigned" : saving ? "Assigning..." : "Assign Mentor"}
      </button>
    </article>
  );
}

function FullQuestionnaire({ answers }) {
  const entries = Object.entries(answers || {}).filter(([, value]) => asArray(value).length || value);
  if (!entries.length) return <p className="dash-muted">No questionnaire answers were recorded.</p>;
  return (
    <div className="matching-team-questionnaire">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span>{QUESTION_LABELS[key] || key}</span>
          <p>{displayList(value)}</p>
        </div>
      ))}
    </div>
  );
}

export default function MatchingTeamPage() {
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ grade: "", major: "", stage: "", status: "", mentorType: "" });
  const [expandedStudentId, setExpandedStudentId] = useState("");
  const [mentorPanelStudentId, setMentorPanelStudentId] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const payload = await loadMatchingTeamQueue();
        if (cancelled) return;
        setStudents(payload.students || []);
        setMentors(payload.mentors || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load Matching Team data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(() => ({
    grades: uniqueOptions(students, (student) => studentSummary(student).grade),
    majors: uniqueOptions(students, (student) => studentSummary(student).interests),
    stages: uniqueOptions(students, (student) => student.questionnaireAnswers?.processStage),
    mentorTypes: uniqueOptions(students, (student) => student.questionnaireAnswers?.mentorQualities)
  }), [students]);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      const answers = student.questionnaireAnswers || {};
      const summary = studentSummary(student);
      const haystack = [
        student.studentName,
        summary.grade,
        ...summary.interests,
        ...summary.goals,
        ...summary.needs,
        ...summary.traits,
        summary.notes
      ].join(" ").toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filters.grade && summary.grade !== filters.grade) return false;
      if (filters.major && !summary.interests.includes(filters.major)) return false;
      if (filters.stage && !asArray(answers.processStage).includes(filters.stage)) return false;
      if (filters.status && student.matchStatus !== filters.status) return false;
      if (filters.mentorType && !asArray(answers.mentorQualities).includes(filters.mentorType)) return false;
      return true;
    });
  }, [filters, query, students]);

  function updateStudent(studentId, patch) {
    setStudents((current) => current.map((student) => student.studentId === studentId ? { ...student, ...patch } : student));
  }

  async function handleAssign(studentId, mentorId) {
    setSavingKey(`${studentId}:${mentorId}`);
    setError("");
    setMessage("");
    try {
      await assignMentorAsMatchingTeam(studentId, mentorId);
      updateStudent(studentId, {
        selectedMentorId: mentorId,
        matchStatus: "matched",
        mentorAssignmentStatus: "matching_team_assigned",
        adminReviewRequired: false
      });
      setMessage("Mentor assigned by the Matching Team.");
    } catch (err) {
      setError(err.message || "Could not assign mentor.");
    } finally {
      setSavingKey("");
    }
  }

  async function handleRemove(studentId) {
    setSavingKey(`${studentId}:remove`);
    setError("");
    setMessage("");
    try {
      await removeMentorAsMatchingTeam(studentId);
      updateStudent(studentId, {
        selectedMentorId: null,
        matchStatus: "needs_review",
        mentorAssignmentStatus: null,
        adminReviewRequired: true
      });
      setMessage("Mentor match removed.");
    } catch (err) {
      setError(err.message || "Could not remove mentor match.");
    } finally {
      setSavingKey("");
    }
  }

  if (loading) return <div className="dash-loading">Loading Matching Team dashboard...</div>;

  return (
    <section className="matching-team-page dash-page dash-page--premium">
      <header className="matching-team-hero">
        <div>
          <p className="dash-eyebrow">Private internal tool</p>
          <h1 className="dash-page-title">Student Matching</h1>
          <p className="dash-page-sub">
            Review questionnaire submissions, compare mentor fit, and assign the best Prelude mentor for each student.
          </p>
        </div>
        <div className="matching-team-hero__stat">
          <strong>{filteredStudents.length}</strong>
          <span>students in view</span>
        </div>
      </header>

      <section className="matching-team-filters dash-panel">
        <label className="matching-team-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students, goals, majors, needs..." />
        </label>
        <div className="matching-team-filter-grid">
          <select value={filters.grade} onChange={(event) => setFilters((current) => ({ ...current, grade: event.target.value }))}>
            <option value="">All grades</option>
            {filterOptions.grades.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.major} onChange={(event) => setFilters((current) => ({ ...current, major: event.target.value }))}>
            <option value="">All interests</option>
            {filterOptions.majors.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.stage} onChange={(event) => setFilters((current) => ({ ...current, stage: event.target.value }))}>
            <option value="">All stages</option>
            {filterOptions.stages.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">All statuses</option>
            <option value="unmatched">Unmatched</option>
            <option value="needs_review">Needs Review</option>
            <option value="matched">Matched</option>
          </select>
          <select value={filters.mentorType} onChange={(event) => setFilters((current) => ({ ...current, mentorType: event.target.value }))}>
            <option value="">All mentor traits</option>
            {filterOptions.mentorTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={() => setFilters({ grade: "", major: "", stage: "", status: "", mentorType: "" })}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Clear filters
        </button>
      </section>

      {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}
      {message ? <p className="pm-match-result__saved" role="status">{message}</p> : null}

      <div className="matching-team-list">
        {filteredStudents.map((student) => {
          const summary = studentSummary(student);
          const matchedMentors = mentors.filter((mentor) => (student.matchedMentorIds || []).includes(mentor.id));
          const otherMentors = mentors.filter((mentor) => !(student.matchedMentorIds || []).includes(mentor.id));
          const mentorChoices = [...matchedMentors, ...otherMentors];
          const assignedMentor = mentors.find((mentor) => mentor.id === student.selectedMentorId);
          const showMentors = mentorPanelStudentId === student.studentId;
          const showFull = expandedStudentId === student.studentId;

          return (
            <article key={student.studentId} className="matching-team-card dash-panel">
              <div className="matching-team-card__top">
                <div>
                  <div className="matching-team-card__title-row">
                    <h2>{student.studentName}</h2>
                    <span className={`matching-team-status ${statusClass(student.matchStatus)}`}>{statusLabel(student.matchStatus)}</span>
                  </div>
                  <p>{summary.grade} · {displayList(summary.interests, "Academic interests not provided")}</p>
                </div>
                <div className="matching-team-card__actions">
                  {student.selectedMentorId ? (
                    <button
                      type="button"
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                      disabled={savingKey === `${student.studentId}:remove`}
                      onClick={() => handleRemove(student.studentId)}
                    >
                      {savingKey === `${student.studentId}:remove` ? "Removing..." : "Remove Match"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="dash-btn dash-btn--primary dash-btn--sm"
                    onClick={() => setMentorPanelStudentId(showMentors ? "" : student.studentId)}
                  >
                    <UserCheck className="h-4 w-4" aria-hidden="true" /> {student.selectedMentorId ? "Change Mentor" : "Find Mentor"}
                  </button>
                </div>
              </div>

              <div className="matching-team-card__grid">
                <StudentField label="College goals" value={displayList(summary.goals)} />
                <StudentField label="Essay/application needs" value={displayList(summary.needs)} />
                <StudentField label="Preferred mentor traits" value={displayList(summary.traits)} />
                <StudentField label="Availability / timing" value={summary.availability} />
              </div>

              {summary.notes ? (
                <div className="matching-team-note">
                  <span>Special notes</span>
                  <p>{summary.notes}</p>
                </div>
              ) : null}

              {assignedMentor ? (
                <p className="matching-team-assigned">Current mentor: <strong>{assignedMentor.name}</strong> · {assignedMentor.school} · {assignedMentor.major}</p>
              ) : null}

              <button
                type="button"
                className="matching-team-link-button"
                onClick={() => setExpandedStudentId(showFull ? "" : student.studentId)}
                aria-expanded={showFull}
              >
                View full questionnaire <ChevronDown className={showFull ? "matching-team-chevron matching-team-chevron--open" : "matching-team-chevron"} aria-hidden="true" />
              </button>
              {showFull ? <FullQuestionnaire answers={student.questionnaireAnswers} /> : null}

              {showMentors ? (
                <section className="matching-team-mentor-panel">
                  <header>
                    <h3>Mentor options</h3>
                    <p>{matchedMentors.length ? "Best algorithmic matches are shown first, followed by the full available mentor pool." : "Full available mentor pool."}</p>
                  </header>
                  <div className="matching-team-mentor-grid">
                    {mentorChoices.map((mentor) => (
                      <MentorCard
                        key={mentor.id}
                        mentor={mentor}
                        selected={mentor.id === student.selectedMentorId}
                        saving={savingKey === `${student.studentId}:${mentor.id}`}
                        onAssign={(mentorId) => handleAssign(student.studentId, mentorId)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </article>
          );
        })}
      </div>

      {!filteredStudents.length ? (
        <div className="dash-empty">No student submissions match the current filters.</div>
      ) : null}
    </section>
  );
}
