import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, ExternalLink, FilePlus2, FileText, Search } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { searchColleges } from "../../../lib/collegeSearch.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  ACTIVITY_TYPE_OPTIONS,
  activityTypeLabel,
  addActivityFeedback,
  createMentorActivity,
  formatFileSize,
  getActivityFileUrl,
  listMentorActivities,
  reviewMentorActivity,
  statusLabel
} from "../../../lib/mentorActivitiesApi.js";
import { DashTabs, EmptyState, Modal, PrimaryButton, SecondaryButton } from "../ui/index.jsx";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "awaiting", label: "Awaiting Submission" },
  { id: "submitted", label: "Submitted" },
  { id: "needs_revision", label: "Needs Revision" },
  { id: "completed", label: "Completed" }
];

function formatDate(value, withTime = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" });
}

function ActivityStatus({ status }) {
  return <span className={cn("dash-activity-status", `dash-activity-status--${status.replaceAll("_", "-")}`)}>{statusLabel(status)}</span>;
}

function CollegeSearchField({ value, onChange, disabled }) {
  const [results, setResults] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused || value.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const colleges = await searchColleges(value, { limit: 6, signal: controller.signal });
      setResults(colleges);
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [focused, value]);

  return (
    <label className="dash-field dash-activity-college-field">
      <span>College</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="Search for a college"
        autoComplete="off"
        disabled={disabled}
      />
      {focused && results.length ? (
        <ul className="dash-activity-college-results" role="listbox">
          {results.map((college) => (
            <li key={college.id || college.name}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                onChange(college.name);
                setResults([]);
                setFocused(false);
              }}>
                <strong>{college.name}</strong>
                <span>{[college.city, college.state].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

export function AssignActivityModal({ open, onClose, students = [], presetStudentId = "", onAssigned, user }) {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentId, setStudentId] = useState(presetStudentId || "");
  const [activityType, setActivityType] = useState("personal_statement");
  const [title, setTitle] = useState("Personal Statement Draft");
  const [titleEdited, setTitleEdited] = useState(false);
  const [collegeName, setCollegeName] = useState("");
  const [essayPrompt, setEssayPrompt] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [allowedSubmissionMethod, setAllowedSubmissionMethod] = useState("either");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId(presetStudentId || "");
    setStudentQuery("");
    setActivityType("personal_statement");
    setTitle("Personal Statement Draft");
    setTitleEdited(false);
    setCollegeName("");
    setEssayPrompt("");
    setWordLimit("");
    setInstructions("");
    setDueDate("");
    setAllowedSubmissionMethod("either");
    setError("");
    setSuccess(false);
  }, [open, presetStudentId]);

  const filteredStudents = students.filter((student) => student.name.toLowerCase().includes(studentQuery.trim().toLowerCase()));
  const collegeSpecific = ["supplemental_essay", "additional_essay"].includes(activityType);

  function changeType(value) {
    const option = ACTIVITY_TYPE_OPTIONS.find((item) => item.value === value);
    setActivityType(value);
    if (!titleEdited) setTitle(option?.defaultTitle || "Writing Activity");
    if (!["supplemental_essay", "additional_essay"].includes(value)) setCollegeName("");
  }

  function changeCollege(value) {
    setCollegeName(value);
    if (!titleEdited && activityType === "supplemental_essay" && value.trim()) {
      setTitle(`${value.trim()} Supplemental Essay`);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!studentId) {
      setError("Choose an assigned student.");
      return;
    }
    setBusy(true);
    try {
      await createMentorActivity({
        studentId,
        activityType,
        title: title.trim(),
        collegeName: collegeSpecific ? collegeName.trim() || null : null,
        essayPrompt: essayPrompt.trim() || null,
        wordLimit: wordLimit ? Number(wordLimit) : null,
        instructions: instructions.trim() || null,
        dueDate: dueDate ? `${dueDate}T23:59:59.999Z` : null,
        allowedSubmissionMethod
      }, user);
      setSuccess(true);
      await onAssigned?.();
    } catch (assignError) {
      setError(assignError.message || "Could not assign this activity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Assign Activity" className="dash-modal--activity" scrollable>
      {success ? (
        <div className="dash-activity-success" role="status">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          <h3>Activity assigned</h3>
          <p>The student can now view and submit it from their dashboard.</p>
          <PrimaryButton type="button" onClick={onClose}>Done</PrimaryButton>
        </div>
      ) : (
        <form className="dash-activity-form" onSubmit={submit}>
          <label className="dash-field dash-form-full">
            <span>Student</span>
            <div className="dash-activity-student-search">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input type="search" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search assigned students" disabled={busy} />
            </div>
            <select value={studentId} onChange={(event) => setStudentId(event.target.value)} required disabled={busy || Boolean(presetStudentId)}>
              <option value="">Select a student</option>
              {filteredStudents.map((student) => <option key={student.id} value={student.id}>{student.name}{student.grade ? ` · ${student.grade}` : ""}</option>)}
            </select>
          </label>

          <div className="dash-form-grid">
            <label className="dash-field">
              <span>Activity type</span>
              <select value={activityType} onChange={(event) => changeType(event.target.value)} disabled={busy}>
                {ACTIVITY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="dash-field">
              <span>Activity title</span>
              <input type="text" value={title} onChange={(event) => {
                setTitle(event.target.value);
                setTitleEdited(true);
              }} maxLength={180} required disabled={busy} />
            </label>
          </div>

          {collegeSpecific ? <CollegeSearchField value={collegeName} onChange={changeCollege} disabled={busy} /> : null}

          <label className="dash-field">
            <span>Essay prompt</span>
            <textarea value={essayPrompt} onChange={(event) => setEssayPrompt(event.target.value)} placeholder="Add the prompt the student should respond to" disabled={busy} />
          </label>

          <div className="dash-form-grid">
            <label className="dash-field">
              <span>Word limit</span>
              <input type="number" min="1" max="100000" value={wordLimit} onChange={(event) => setWordLimit(event.target.value)} placeholder="Optional" disabled={busy} />
            </label>
            <label className="dash-field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={busy} />
            </label>
          </div>

          <label className="dash-field">
            <span>Instructions</span>
            <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Explain what the student should complete" disabled={busy} />
          </label>

          <label className="dash-field">
            <span>Submission methods</span>
            <select value={allowedSubmissionMethod} onChange={(event) => setAllowedSubmissionMethod(event.target.value)} disabled={busy}>
              <option value="document_link">Document link</option>
              <option value="file_upload">File upload</option>
              <option value="either">Either method</option>
            </select>
          </label>

          {error ? <p className="dash-field-error" role="alert">{error}</p> : null}
          <div className="dash-activity-form__actions">
            <SecondaryButton type="button" onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" loading={busy} disabled={busy || !studentId || !title.trim()}>Assign Activity</PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

function MentorReviewModal({ activity, open, onClose, onChanged, user }) {
  const [feedbackText, setFeedbackText] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submissions = (activity?.submissions || []).filter((item) => !item.isDraft);
  const latestSubmission = submissions[0] || null;

  useEffect(() => {
    if (!open) return;
    setFeedbackText("");
    setError("");
    setSuccess("");
    setBusyAction("");
  }, [activity?.id, open]);

  async function openFile(submission) {
    setError("");
    const tab = window.open("", "_blank", "noopener,noreferrer");
    try {
      const { signedUrl } = await getActivityFileUrl(activity.id, submission.id, user);
      if (tab) tab.location = signedUrl;
      else window.location.assign(signedUrl);
    } catch (fileError) {
      tab?.close();
      setError(fileError.message || "Could not open the secure file.");
    }
  }

  async function leaveFeedback() {
    if (!feedbackText.trim()) {
      setError("Write feedback before saving it.");
      return;
    }
    setBusyAction("feedback");
    setError("");
    try {
      await addActivityFeedback(activity.id, { feedbackText: feedbackText.trim(), submissionId: latestSubmission?.id || null }, user);
      setFeedbackText("");
      setSuccess("Feedback saved and the student was notified.");
      await onChanged?.();
    } catch (feedbackError) {
      setError(feedbackError.message || "Could not save feedback.");
    } finally {
      setBusyAction("");
    }
  }

  async function review(status) {
    if (status === "needs_revision" && !feedbackText.trim()) {
      setError("Add written feedback before requesting a revision.");
      return;
    }
    setBusyAction(status);
    setError("");
    try {
      await reviewMentorActivity(activity.id, {
        status,
        feedbackText: feedbackText.trim() || null,
        submissionId: latestSubmission?.id || null
      }, user);
      setFeedbackText("");
      setSuccess(status === "completed" ? "Activity marked completed." : "Revision requested and the student was notified.");
      await onChanged?.();
    } catch (reviewError) {
      setError(reviewError.message || "Could not update this activity.");
    } finally {
      setBusyAction("");
    }
  }

  const completed = activity?.storedStatus === "completed";

  return (
    <Modal open={open} onClose={busyAction ? () => {} : onClose} title={activity?.title || "Review Activity"} className="dash-modal--activity" scrollable>
      <div className="dash-activity-detail dash-activity-review">
        <div className="dash-activity-review__summary">
          <div><strong>Student</strong><span>{activity.studentName}</span></div>
          <div><strong>Activity type</strong><span>{activityTypeLabel(activity.activityType)}</span></div>
          {activity.collegeName ? <div><strong>College</strong><span>{activity.collegeName}</span></div> : null}
          {activity.dueDate ? <div><strong>Due</strong><span>{formatDate(activity.dueDate)}</span></div> : null}
          <div><strong>Status</strong><ActivityStatus status={activity.status} /></div>
        </div>

        {activity.essayPrompt ? <section className="dash-activity-detail__section"><h3>Essay prompt</h3><p>{activity.essayPrompt}</p>{activity.wordLimit ? <span>{activity.wordLimit} word limit</span> : null}</section> : null}
        {activity.instructions ? <section className="dash-activity-detail__section"><h3>Instructions</h3><p>{activity.instructions}</p></section> : null}

        <section className="dash-activity-detail__section">
          <h3>Submission history</h3>
          {submissions.length ? (
            <ol className="dash-activity-history">
              {submissions.map((submission, index) => (
                <li key={submission.id} className="dash-activity-history__item">
                  <div className="dash-activity-history__head">
                    <div><strong>Revision {submissions.length - index}</strong><span>Submitted {formatDate(submission.submittedAt, true)}</span></div>
                    {submission.submissionMethod === "document_link" ? (
                      <a className="dash-btn dash-btn--secondary dash-btn--sm" href={submission.documentUrl} target="_blank" rel="noreferrer">Open document <ExternalLink className="h-3.5 w-3.5" /></a>
                    ) : (
                      <SecondaryButton type="button" className="dash-btn--sm" onClick={() => openFile(submission)}>Download <Download className="h-3.5 w-3.5" /></SecondaryButton>
                    )}
                  </div>
                  {submission.originalFileName ? <p className="dash-activity-history__file">{submission.originalFileName} · {formatFileSize(submission.fileSize)}</p> : null}
                  {(submission.feedback || []).map((feedback) => <blockquote key={feedback.id} className="dash-activity-feedback"><strong>{feedback.mentorName}</strong><p>{feedback.feedbackText}</p></blockquote>)}
                </li>
              ))}
            </ol>
          ) : <p className="dash-activity-history__empty">The student has not submitted work yet.</p>}
        </section>

        {!completed ? (
          <section className="dash-activity-review__feedback">
            <label className="dash-field">
              <span>Written feedback</span>
              <textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Give the student clear, actionable feedback" disabled={Boolean(busyAction)} />
              <em>Feedback is required when requesting a revision.</em>
            </label>
            {error ? <p className="dash-field-error" role="alert">{error}</p> : null}
            {success ? <p className="dash-activity-inline-success" role="status">{success}</p> : null}
            <div className="dash-activity-review__actions">
              <SecondaryButton type="button" onClick={leaveFeedback} loading={busyAction === "feedback"} disabled={Boolean(busyAction) || !feedbackText.trim()}>Add Feedback</SecondaryButton>
              <SecondaryButton type="button" onClick={() => review("needs_revision")} loading={busyAction === "needs_revision"} disabled={Boolean(busyAction) || !latestSubmission}>Needs Revision</SecondaryButton>
              <PrimaryButton type="button" onClick={() => review("completed")} loading={busyAction === "completed"} disabled={Boolean(busyAction) || !latestSubmission}>Mark Completed</PrimaryButton>
            </div>
          </section>
        ) : <div className="dash-activity-complete-note"><CheckCircle2 className="h-5 w-5" /> This activity is completed.</div>}
        {error && completed ? <p className="dash-field-error" role="alert">{error}</p> : null}
      </div>
    </Modal>
  );
}

export default function MentorActivitiesPanel({ compact = false, onStudentsLoaded }) {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listMentorActivities(undefined, user);
      setActivities(data.activities || []);
      setStudents(data.students || []);
      onStudentsLoaded?.(data.students || []);
    } catch (loadError) {
      setError(loadError.message || "Activities are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.email]);

  const filtered = useMemo(() => activities.filter((activity) => {
    if (filter === "all") return true;
    if (filter === "awaiting") return ["not_started", "in_progress", "overdue"].includes(activity.status);
    return activity.status === filter || activity.storedStatus === filter;
  }), [activities, filter]);
  const selected = activities.find((activity) => activity.id === selectedId) || null;

  return (
    <section className={cn("dash-mentor-activities", "dash-mentor-activities--mentor", compact && "dash-mentor-activities--compact")} aria-labelledby="mentor-activity-review-heading">
      <div className="dash-mentor-activities__head">
        <div>
          <h2 id="mentor-activity-review-heading">Mentor-Assigned Activities</h2>
          <p>Assign writing work and review student submissions.</p>
        </div>
        <PrimaryButton type="button" className="dash-btn--sm" onClick={() => setAssignOpen(true)} disabled={!students.length}>
          <FilePlus2 className="h-4 w-4" /> Assign Activity
        </PrimaryButton>
      </div>

      <DashTabs tabs={FILTERS} active={filter} onChange={setFilter} />

      {loading ? <div className="dash-activity-skeleton" role="status"><span /><span /><span /></div> : error ? (
        <div className="dash-activity-error" role="alert"><p>{error}</p><SecondaryButton type="button" className="dash-btn--sm" onClick={load}>Retry</SecondaryButton></div>
      ) : filtered.length ? (
        <div className="dash-mentor-activities__list">
          {filtered.map((activity) => {
            const latest = activity.submissions?.find((item) => !item.isDraft);
            return (
              <article key={activity.id} className="dash-activity-row dash-activity-row--mentor">
                <div className="dash-activity-row__icon"><FileText className="h-5 w-5" /></div>
                <div className="dash-activity-row__body">
                  <div className="dash-activity-row__title-line"><h3>{activity.title}</h3><ActivityStatus status={activity.status} /></div>
                  <div className="dash-activity-meta">
                    <strong>{activity.studentName}</strong>
                    <span>{activityTypeLabel(activity.activityType)}</span>
                    {activity.collegeName ? <span>{activity.collegeName}</span> : null}
                    {activity.dueDate ? <span>Due {formatDate(activity.dueDate)}</span> : null}
                    {latest?.submittedAt ? <span>Submitted {formatDate(latest.submittedAt)}</span> : null}
                  </div>
                </div>
                <SecondaryButton type="button" className="dash-btn--sm dash-activity-row__action" onClick={() => setSelectedId(activity.id)}>
                  {latest ? "Review Submission" : "View Activity"}
                </SecondaryButton>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={FileText} title={activities.length ? "No activities match this filter" : "No activities assigned yet"} description={activities.length ? "Choose another status to see more activities." : "Assign an activity to an assigned student to get started."} />
      )}

      <AssignActivityModal open={assignOpen} onClose={() => setAssignOpen(false)} students={students} onAssigned={load} user={user} />
      {selected ? <MentorReviewModal activity={selected} open onClose={() => setSelectedId(null)} onChanged={load} user={user} /> : null}
    </section>
  );
}
