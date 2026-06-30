import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase.js";
import { assignMentorAsAdmin, loadAdminMentorReviewQueue } from "../../../lib/mentorSelectionApi.js";

function mapMentorOption(row) {
  return {
    id: row.mentor_user_id,
    name: row.display_name || "Prelude mentor",
    school: row.college || "",
    major: row.major || ""
  };
}

export default function AdminMentorReviewPage() {
  const [students, setStudents] = useState([]);
  const [mentorOptions, setMentorOptions] = useState({});
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [{ students: queue }, mentorsRes] = await Promise.all([
          loadAdminMentorReviewQueue(),
          getSupabase()?.from("mentor_matching_profiles").select("mentor_user_id, display_name, college, major").eq("completed", true) || { data: [] }
        ]);
        if (cancelled) return;
        setStudents(queue || []);
        const allMentors = (mentorsRes?.data || []).map(mapMentorOption);
        const optionsByStudent = {};
        for (const student of queue || []) {
          const matched = student.matchedMentorIds || [];
          optionsByStudent[student.studentId] = matched.length
            ? allMentors.filter((mentor) => matched.includes(mentor.id))
            : allMentors;
        }
        setMentorOptions(optionsByStudent);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load mentor review queue.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAssign(studentId) {
    const mentorId = assignments[studentId];
    if (!mentorId) return;
    setSavingId(studentId);
    setError("");
    setMessage("");
    try {
      await assignMentorAsAdmin(studentId, mentorId);
      setStudents((current) => current.filter((student) => student.studentId !== studentId));
      setMessage("Mentor assigned successfully.");
    } catch (err) {
      setError(err.message || "Could not assign mentor.");
    } finally {
      setSavingId("");
    }
  }

  if (loading) {
    return <div className="dash-loading">Loading mentor review queue…</div>;
  }

  return (
    <section className="admin-mentor-review">
      <header>
        <h1 className="dash-page-title">Mentor match review</h1>
        <p className="dash-page-sub">
          Students who need admin review after PreludeMatch — assign the best mentor from their matches or the full mentor pool.
        </p>
      </header>

      {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}
      {message ? <p className="pm-match-result__saved" role="status">{message}</p> : null}

      {!students.length ? (
        <p className="dash-empty">No students are waiting for mentor review.</p>
      ) : (
        <div className="admin-mentor-review__list">
          {students.map((student) => (
            <article key={student.studentId} className="admin-mentor-review__card">
              <h2 className="dash-card__title">{student.studentName}</h2>
              <div className="admin-mentor-review__meta">
                <span>Matched mentors: {student.matchedMentorCount}</span>
                <span>Status: {student.mentorAssignmentStatus || "admin_review_required"}</span>
                <span>Selection method: {student.mentorSelectionMethod || "admin_review_required"}</span>
                {student.selectionTimestamp ? <span>Submitted: {new Date(student.selectionTimestamp).toLocaleString()}</span> : null}
              </div>
              <details>
                <summary>PreludeMatch answers</summary>
                <pre className="dash-code-block">{JSON.stringify(student.questionnaireAnswers, null, 2)}</pre>
              </details>
              <div className="admin-mentor-review__assign">
                <select
                  value={assignments[student.studentId] || ""}
                  onChange={(event) =>
                    setAssignments((current) => ({ ...current, [student.studentId]: event.target.value }))
                  }
                >
                  <option value="">Select mentor…</option>
                  {(mentorOptions[student.studentId] || []).map((mentor) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.name} · {mentor.school} · {mentor.major}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="dash-btn dash-btn--primary"
                  disabled={!assignments[student.studentId] || savingId === student.studentId}
                  onClick={() => handleAssign(student.studentId)}
                >
                  {savingId === student.studentId ? "Assigning…" : "Assign mentor"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
