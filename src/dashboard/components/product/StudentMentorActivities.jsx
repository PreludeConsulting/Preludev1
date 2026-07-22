import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Link2,
  UploadCloud
} from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import {
  ACTIVITY_ACCEPT,
  ACTIVITY_MAX_FILE_BYTES,
  SUBMISSION_METHOD_OPTIONS,
  activityPrimaryAction,
  activityTypeLabel,
  formatFileSize,
  getActivityFileUrl,
  isValidDocumentLink,
  listStudentActivities,
  removeActivityDraftFile,
  requestActivityUpload,
  resolveActivityFileMime,
  saveActivitySubmission,
  statusLabel,
  uploadActivityFile,
  validateActivityFile
} from "../../../lib/mentorActivitiesApi.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { EmptyState, Modal, PrimaryButton, SecondaryButton } from "../ui/index.jsx";

function formatDate(value, options = {}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", ...options });
}

function ActivityStatus({ status }) {
  return (
    <span className={cn("dash-activity-status", `dash-activity-status--${status.replaceAll("_", "-")}`)}>
      {statusLabel(status)}
    </span>
  );
}

function ActivityMeta({ activity }) {
  return (
    <div className="dash-activity-meta">
      <span>{activityTypeLabel(activity.activityType)}</span>
      {activity.collegeName ? <span>{activity.collegeName}</span> : null}
      <span>Mentor: {activity.mentorName}</span>
      {activity.dueDate ? <span>Due {formatDate(activity.dueDate)}</span> : null}
    </div>
  );
}

function SubmissionHistory({ activity, onOpenFile }) {
  const history = (activity.submissions || []).filter((item) => !item.isDraft);
  if (!history.length) return <p className="dash-activity-history__empty">No submitted revisions yet.</p>;
  return (
    <ol className="dash-activity-history">
      {history.map((submission, index) => (
        <li key={submission.id} className="dash-activity-history__item">
          <div className="dash-activity-history__head">
            <div>
              <strong>Revision {history.length - index}</strong>
              <span>{formatDate(submission.submittedAt, { hour: "numeric", minute: "2-digit" })}</span>
            </div>
            {submission.submissionMethod === "document_link" ? (
              <a className="dash-btn dash-btn--secondary dash-btn--sm" href={submission.documentUrl} target="_blank" rel="noreferrer">
                Open link <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <SecondaryButton type="button" className="dash-btn--sm" onClick={() => onOpenFile(submission)}>
                Download <Download className="h-3.5 w-3.5" />
              </SecondaryButton>
            )}
          </div>
          {submission.originalFileName ? (
            <p className="dash-activity-history__file">{submission.originalFileName} · {formatFileSize(submission.fileSize)}</p>
          ) : null}
          {(submission.feedback || []).map((feedback) => (
            <blockquote key={feedback.id} className="dash-activity-feedback">
              <strong>{feedback.mentorName}</strong>
              <p>{feedback.feedbackText}</p>
            </blockquote>
          ))}
        </li>
      ))}
    </ol>
  );
}

function ActivitySubmissionModal({ activity, open, onClose, onChanged, user }) {
  const latestDraft = activity?.submissions?.find((item) => item.isDraft);
  const latestSubmitted = activity?.submissions?.find((item) => !item.isDraft);
  const startingSubmission = latestDraft || latestSubmitted;
  const [method, setMethod] = useState(startingSubmission?.submissionMethod || "");
  const [documentUrl, setDocumentUrl] = useState(startingSubmission?.documentUrl || "");
  const [fileData, setFileData] = useState(
    latestDraft?.storagePath
      ? {
          storagePath: latestDraft.storagePath,
          originalFileName: latestDraft.originalFileName,
          fileMimeType: latestDraft.fileMimeType,
          fileSize: latestDraft.fileSize
        }
      : null
  );
  const [progress, setProgress] = useState(fileData ? 100 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [replaceAfterRemove, setReplaceAfterRemove] = useState(false);
  const fileInputRef = useRef(null);
  const submitKeyRef = useRef(null);
  const completed = activity?.storedStatus === "completed" || activity?.status === "completed";

  useEffect(() => {
    if (!open) return;
    const draft = activity?.submissions?.find((item) => item.isDraft);
    const submitted = activity?.submissions?.find((item) => !item.isDraft);
    const initial = draft || submitted;
    setMethod(initial?.submissionMethod || "");
    setDocumentUrl(initial?.documentUrl || "");
    setFileData(draft?.storagePath ? {
      storagePath: draft.storagePath,
      originalFileName: draft.originalFileName,
      fileMimeType: draft.fileMimeType,
      fileSize: draft.fileSize
    } : null);
    setProgress(draft?.storagePath ? 100 : 0);
    setError("");
    setSuccess("");
    setRemoveConfirm(false);
    setReplaceAfterRemove(false);
    submitKeyRef.current = null;
  }, [activity, open]);

  async function handleFile(file) {
    setError("");
    const validation = validateActivityFile(file, ACTIVITY_MAX_FILE_BYTES);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const mime = resolveActivityFileMime(file);
      const upload = await requestActivityUpload(activity.id, file, user);
      await uploadActivityFile(upload.signedUrl, file, mime, setProgress);
      setFileData({
        storagePath: upload.path,
        originalFileName: file.name,
        fileMimeType: mime,
        fileSize: file.size
      });
      setProgress(100);
    } catch (uploadError) {
      setProgress(0);
      setError(uploadError.message || "The file upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemove() {
    if (!fileData?.storagePath) return;
    setBusy(true);
    setError("");
    try {
      await removeActivityDraftFile(activity.id, fileData.storagePath, user);
      setFileData(null);
      setProgress(0);
      setRemoveConfirm(false);
      await onChanged?.();
      if (replaceAfterRemove) {
        setReplaceAfterRemove(false);
        window.setTimeout(() => fileInputRef.current?.click(), 0);
      }
    } catch (removeError) {
      setError(removeError.message || "Could not remove the draft file.");
    } finally {
      setBusy(false);
    }
  }

  function submissionPayload(isDraft) {
    if (!method) throw new Error("Choose how you would like to submit your work.");
    if (method === "document_link") {
      if (!isValidDocumentLink(documentUrl)) throw new Error("Enter a valid http:// or https:// document link.");
      return { submissionMethod: method, documentUrl: documentUrl.trim(), isDraft };
    }
    if (!fileData?.storagePath) throw new Error("Upload a PDF, DOC, or DOCX file first.");
    return { submissionMethod: method, ...fileData, isDraft };
  }

  async function save(isDraft) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload = submissionPayload(isDraft);
      if (!isDraft && !submitKeyRef.current) submitKeyRef.current = crypto.randomUUID();
      const idempotencyKey = isDraft ? null : submitKeyRef.current;
      await saveActivitySubmission(activity.id, payload, idempotencyKey, user);
      if (isDraft) {
        setSuccess("Draft saved.");
      } else {
        setSuccess("submitted");
        submitKeyRef.current = null;
      }
      await onChanged?.();
    } catch (saveError) {
      setError(saveError.message || "Could not save this submission.");
    } finally {
      setBusy(false);
    }
  }

  async function openFile(submission) {
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

  const availableMethods = SUBMISSION_METHOD_OPTIONS.filter((option) => (
    activity?.allowedSubmissionMethod === "either" || activity?.allowedSubmissionMethod === option.value
  ));

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={activity?.title || "Activity"} className="dash-modal--activity" scrollable>
      {success === "submitted" ? (
        <div className="dash-activity-success" role="status">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          <h3>Submitted to your mentor</h3>
          <p>Your mentor will be notified and can now review your work.</p>
          <PrimaryButton type="button" onClick={onClose}>Done</PrimaryButton>
        </div>
      ) : (
        <div className="dash-activity-detail">
          <div className="dash-activity-detail__top">
            <ActivityStatus status={activity?.status || "not_started"} />
            <ActivityMeta activity={activity} />
          </div>

          {activity?.essayPrompt ? (
            <section className="dash-activity-detail__section">
              <h3>Essay prompt</h3>
              <p>{activity.essayPrompt}</p>
              {activity.wordLimit ? <span className="dash-activity-detail__limit">{activity.wordLimit} word limit</span> : null}
            </section>
          ) : activity?.wordLimit ? (
            <p className="dash-activity-detail__limit">{activity.wordLimit} word limit</p>
          ) : null}

          {activity?.instructions ? (
            <section className="dash-activity-detail__section">
              <h3>Mentor instructions</h3>
              <p>{activity.instructions}</p>
            </section>
          ) : null}

          {!completed ? (
            <section className="dash-activity-submission" aria-labelledby="activity-submission-heading">
              <h3 id="activity-submission-heading">Your submission</h3>
              <label className="dash-field">
                <span>How would you like to submit your work?</span>
                <select value={method} onChange={(event) => {
                  setMethod(event.target.value);
                  setError("");
                }} disabled={busy}>
                  <option value="">Select a submission method</option>
                  {availableMethods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              {method === "document_link" ? (
                <label className="dash-field">
                  <span>Document link</span>
                  <div className="dash-activity-link-input">
                    <Link2 className="h-4 w-4" aria-hidden="true" />
                    <input
                      type="url"
                      value={documentUrl}
                      onChange={(event) => setDocumentUrl(event.target.value)}
                      placeholder="Paste a Google Docs or shared document link"
                      aria-invalid={Boolean(documentUrl && !isValidDocumentLink(documentUrl))}
                      disabled={busy}
                    />
                  </div>
                  <em>Make sure your mentor has permission to view the document.</em>
                </label>
              ) : null}

              {method === "file_upload" ? (
                <div className="dash-field">
                  <span>Upload a file</span>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept={ACTIVITY_ACCEPT}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) handleFile(file);
                    }}
                  />
                  {!fileData ? (
                    <button
                      type="button"
                      className="dash-activity-dropzone"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files?.[0];
                        if (file) handleFile(file);
                      }}
                    >
                      <UploadCloud className="h-7 w-7" aria-hidden="true" />
                      <strong>Drop your file here or choose a file</strong>
                      <span>PDF, DOC, or DOCX · up to 10 MB</span>
                    </button>
                  ) : (
                    <div className="dash-activity-file">
                      <FileText className="h-6 w-6" aria-hidden="true" />
                      <div className="dash-activity-file__body">
                        <strong title={fileData.originalFileName}>{fileData.originalFileName}</strong>
                        <span>{formatFileSize(fileData.fileSize)}</span>
                        <div className="dash-activity-upload-progress" aria-label={`Upload ${progress}% complete`}>
                          <span style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="dash-activity-file__actions">
                        <button type="button" onClick={() => {
                          setReplaceAfterRemove(true);
                          setRemoveConfirm(true);
                        }} disabled={busy}>Replace</button>
                        <button type="button" onClick={() => {
                          setReplaceAfterRemove(false);
                          setRemoveConfirm(true);
                        }} disabled={busy}>Remove</button>
                      </div>
                    </div>
                  )}
                  {removeConfirm ? (
                    <div className="dash-activity-remove-confirm" role="alert">
                      <p>{replaceAfterRemove ? "Replacing this file permanently removes the current draft file." : "Permanently remove this draft file?"}</p>
                      <div>
                        <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setRemoveConfirm(false)} disabled={busy}>Keep file</SecondaryButton>
                        <PrimaryButton type="button" className="dash-btn--sm" onClick={confirmRemove} loading={busy}>Continue</PrimaryButton>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="dash-field-error" role="alert">{error}</p> : null}
              {success ? <p className="dash-activity-inline-success" role="status">{success}</p> : null}
              <div className="dash-activity-submission__actions">
                <SecondaryButton type="button" onClick={() => save(true)} disabled={busy || !method} loading={busy}>Save Draft</SecondaryButton>
                <PrimaryButton type="button" onClick={() => save(false)} disabled={busy || !method} loading={busy}>Submit to Mentor</PrimaryButton>
              </div>
            </section>
          ) : (
            <div className="dash-activity-complete-note"><CheckCircle2 className="h-5 w-5" /> This activity is complete and read-only.</div>
          )}

          <section className="dash-activity-detail__section">
            <h3>Submission history</h3>
            <SubmissionHistory activity={activity} onOpenFile={openFile} />
          </section>
          {error && completed ? <p className="dash-field-error" role="alert">{error}</p> : null}
        </div>
      )}
    </Modal>
  );
}

export default function StudentMentorActivities({ className }) {
  const { user } = useAuth();
  const { isMentorStudentView } = useDashboardData();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    if (isMentorStudentView) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await listStudentActivities(user);
      setActivities(data.activities || []);
    } catch (loadError) {
      setError(loadError.message || "Activities are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [isMentorStudentView, user?.email]);

  const selected = activities.find((activity) => activity.id === selectedId) || null;
  const incompleteCount = useMemo(
    () => activities.filter((activity) => activity.storedStatus !== "completed").length,
    [activities]
  );
  const visible = showAll ? activities : activities.slice(0, 3);

  if (isMentorStudentView) return null;

  return (
    <section className={cn("dash-mentor-activities", "dash-mentor-activities--student", className)} aria-labelledby="mentor-activities-heading">
      <div className="dash-mentor-activities__head">
        <div>
          <div className="dash-mentor-activities__title-row">
            <h2 id="mentor-activities-heading">Mentor-Assigned Activities</h2>
            {incompleteCount ? <span className="dash-mentor-activities__count">{incompleteCount} incomplete</span> : null}
          </div>
          <p>Complete and submit activities assigned by your mentor.</p>
        </div>
      </div>

      {loading ? (
        <div className="dash-activity-skeleton" role="status" aria-label="Loading mentor-assigned activities">
          <span /><span /><span />
        </div>
      ) : error ? (
        <div className="dash-activity-error" role="alert">
          <p>{error}</p>
          <SecondaryButton type="button" className="dash-btn--sm" onClick={load}>Retry</SecondaryButton>
        </div>
      ) : activities.length === 0 ? (
        <EmptyState icon={FileText} title="No activities assigned yet" description="Activities from your mentor will appear here." />
      ) : (
        <div className="dash-mentor-activities__list">
          {visible.map((activity) => (
            <article key={activity.id} className="dash-activity-row">
              <div className="dash-activity-row__icon" aria-hidden="true">
                {activity.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
              </div>
              <div className="dash-activity-row__body">
                <div className="dash-activity-row__title-line">
                  <h3>{activity.title}</h3>
                  <ActivityStatus status={activity.status} />
                </div>
                <ActivityMeta activity={activity} />
                {activity.instructions ? <p className="dash-activity-row__instructions">{activity.instructions}</p> : null}
              </div>
              <PrimaryButton type="button" className="dash-btn--sm dash-activity-row__action" onClick={() => setSelectedId(activity.id)}>
                {activityPrimaryAction(activity.status)}
              </PrimaryButton>
            </article>
          ))}
          {activities.length > 3 ? (
            <button type="button" className="dash-mentor-activities__view-all" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Show Fewer Activities" : "View All Activities"}
            </button>
          ) : null}
        </div>
      )}

      {selected ? (
        <ActivitySubmissionModal
          key={selected.id}
          activity={selected}
          open
          onClose={() => setSelectedId(null)}
          onChanged={load}
          user={user}
        />
      ) : null}
    </section>
  );
}
