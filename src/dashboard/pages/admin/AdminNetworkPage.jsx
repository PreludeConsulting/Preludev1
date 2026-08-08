import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Users } from "lucide-react";
import { loadMatchingTeamQueue } from "../../../lib/mentorSelectionApi.js";
import {
  adminAddStudentNetworkMentor,
  adminGetStudentNetwork,
  adminRemoveStudentNetworkMentor
} from "../../../lib/mentorNetworkApi.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function displayList(value, fallback = "Not provided") {
  const items = asArray(value);
  if (!items.length) return fallback;
  return items
    .map((item) => (typeof item === "string" ? item : item?.name || item?.label || String(item)))
    .join(", ");
}

function studentGrade(student) {
  return student.questionnaireAnswers?.grade || "";
}

function AdminNetworkMentorCard({ mentor, inNetwork, saving, disabled, onAdd, onRemove }) {
  return (
    <article className={`matching-team-mentor-card${inNetwork ? " matching-team-mentor-card--selected" : ""}`}>
      <div className="matching-team-mentor-card__head">
        <div className="matching-team-mentor-card__avatar">{mentor.initials || "M"}</div>
        <div>
          <h4>{mentor.name}</h4>
          <p>{[mentor.school, mentor.major].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {mentor.bio ? <p className="matching-team-mentor-card__bio">{mentor.bio}</p> : null}
      <dl className="matching-team-mentor-card__facts">
        <div><dt>Strengths</dt><dd>{displayList(mentor.applicationStrengths || mentor.specialties)}</dd></div>
        <div><dt>Style</dt><dd>{displayList(mentor.supportStyles)}</dd></div>
        <div><dt>Targets</dt><dd>{displayList(mentor.targetMajors)}</dd></div>
        <div><dt>Availability</dt><dd>{mentor.availability || "Not provided"}</dd></div>
      </dl>
      {[...(mentor.specialties || []), ...(mentor.targetSchools || [])].length ? (
        <div className="matching-team-mentor-card__pills">
          {[...(mentor.specialties || []), ...(mentor.targetSchools || [])].slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {inNetwork ? (
        <div className="matching-team-mentor-card__network-actions">
          <span className="matching-team-status matching-team-status--matched">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> In Network
          </span>
          <button
            type="button"
            className="dash-btn dash-btn--secondary dash-btn--sm"
            disabled={saving}
            onClick={() => onRemove(mentor.id)}
          >
            {saving ? "Removing…" : "Remove"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="dash-btn dash-btn--primary dash-btn--sm"
          disabled={saving || disabled}
          onClick={() => onAdd(mentor.id)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> {saving ? "Adding…" : "Add to Network"}
        </button>
      )}
    </article>
  );
}

export default function AdminNetworkPage() {
  const [students, setStudents] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [network, setNetwork] = useState({ eligible: false, mentorIds: [] });
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [savingMentorId, setSavingMentorId] = useState("");

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
        if (!cancelled) setError(err.message || "Could not load Network data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.studentName, studentGrade(student)].join(" ").toLowerCase().includes(needle)
    );
  }, [students, query]);

  const selectedStudent = students.find((student) => student.studentId === selectedStudentId) || null;
  const mentorIdSet = useMemo(() => new Set(network.mentorIds || []), [network.mentorIds]);

  async function selectStudent(studentId) {
    setSelectedStudentId(studentId);
    setMessage("");
    setError("");
    setNetwork({ eligible: false, mentorIds: [] });
    setLoadingNetwork(true);
    const result = await adminGetStudentNetwork(studentId);
    setLoadingNetwork(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setNetwork({ eligible: result.eligible, mentorIds: result.mentorIds });
  }

  async function handleAdd(mentorId) {
    if (!selectedStudentId) return;
    setSavingMentorId(mentorId);
    setError("");
    setMessage("");
    const result = await adminAddStudentNetworkMentor(selectedStudentId, mentorId);
    setSavingMentorId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    setNetwork({ eligible: result.eligible, mentorIds: result.mentorIds });
    setMessage("Mentor added to the student's network.");
  }

  async function handleRemove(mentorId) {
    if (!selectedStudentId) return;
    setSavingMentorId(mentorId);
    setError("");
    setMessage("");
    const result = await adminRemoveStudentNetworkMentor(selectedStudentId, mentorId);
    setSavingMentorId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    setNetwork({ eligible: result.eligible, mentorIds: result.mentorIds });
    setMessage("Mentor removed from the student's network.");
  }

  if (loading) return <div className="dash-loading">Loading Mentor Network…</div>;

  return (
    <section className="matching-team-page dash-page dash-page--premium">
      <header className="matching-team-hero">
        <div>
          <p className="dash-eyebrow">Private internal tool</p>
          <h1 className="dash-page-title">Mentor Network</h1>
          <p className="dash-page-sub">Manage which Prelude mentors each student can connect with.</p>
        </div>
        <div className="matching-team-hero__stat">
          <strong>{error ? "—" : mentors.length}</strong>
          <span>mentors available</span>
        </div>
      </header>

      {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}
      {message ? <p className="pm-match-result__saved" role="status">{message}</p> : null}

      <section className="matching-team-filters dash-panel">
        <label className="matching-team-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search students by name or grade…"
          />
        </label>
        <div className="admin-network-student-picker">
          {filteredStudents.length ? (
            filteredStudents.map((student) => (
              <button
                key={student.studentId}
                type="button"
                className={
                  "admin-network-student-chip" +
                  (student.studentId === selectedStudentId ? " admin-network-student-chip--active" : "")
                }
                onClick={() => selectStudent(student.studentId)}
              >
                <span className="admin-network-student-chip__name">{student.studentName || "Student"}</span>
                {studentGrade(student) ? (
                  <span className="admin-network-student-chip__meta">{studentGrade(student)}</span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="dash-muted">No students match your search.</p>
          )}
        </div>
      </section>

      {!selectedStudent ? (
        <div className="dash-empty">
          <Users className="h-5 w-5" aria-hidden="true" /> Select a student to manage their Mentor Network.
        </div>
      ) : (
        <div className="matching-team-list">
          <article className="matching-team-card dash-panel">
            <div className="matching-team-card__top">
              <div>
                <div className="matching-team-card__title-row">
                  <h2>Mentor Network for {selectedStudent.studentName}</h2>
                  <span
                    className={
                      "matching-team-status " +
                      (network.eligible ? "matching-team-status--matched" : "matching-team-status--unmatched")
                    }
                  >
                    {network.eligible ? "Mentor Network eligible" : "Mentor Network unavailable"}
                  </span>
                </div>
                <p>
                  {network.eligible
                    ? "Add or remove the mentors this student can browse and message."
                    : "Mentor Network is available with an active Plus or Pro plan."}
                </p>
              </div>
            </div>

            {loadingNetwork ? (
              <div className="dash-loading">Loading student network…</div>
            ) : mentors.length ? (
              <section className="matching-team-mentor-panel">
                <header>
                  <h3>Prelude mentors</h3>
                  <p>
                    {network.eligible
                      ? "Mentor details are pulled live from each mentor's current profile."
                      : "Adding mentors is disabled until the student has an active Plus or Pro plan."}
                  </p>
                </header>
                <div className="matching-team-mentor-grid">
                  {mentors.map((mentor) => (
                    <AdminNetworkMentorCard
                      key={mentor.id}
                      mentor={mentor}
                      inNetwork={mentorIdSet.has(mentor.id)}
                      saving={savingMentorId === mentor.id}
                      disabled={!network.eligible}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="dash-empty">No Prelude mentors are available yet.</div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
