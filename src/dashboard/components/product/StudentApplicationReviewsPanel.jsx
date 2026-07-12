import { useMemo, useState } from "react";
import { FileText, Upload } from "lucide-react";
import {
  APPLICATION_REVIEW_COMPONENT_TYPES,
  APPLICATION_REVIEW_STATUS,
  getComponentTypeLabel,
  getReviewStatusLabel
} from "../../../lib/applicationReviewData.js";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { EmptyState, SectionCard } from "../ui/index.jsx";

function statusClass(status) {
  if (status === APPLICATION_REVIEW_STATUS.COMPLETED) return "dash-review-status--completed";
  if (status === APPLICATION_REVIEW_STATUS.IN_REVIEW) return "dash-review-status--in-review";
  return "dash-review-status--submitted";
}

export default function StudentApplicationReviewsPanel() {
  const { applicationReviews = [], submitApplicationReview, mentor } = useDashboardData();
  const {
    monthlyApplicationReviewLimit,
    remainingApplicationReviews,
    applicationReviewBalanceLabel,
    canSubmitReview
  } = usePlanAccess();

  const [componentType, setComponentType] = useState("personal_statement");
  const [contentText, setContentText] = useState("");
  const [fileName, setFileName] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const remaining = remainingApplicationReviews(applicationReviews);
  const canSubmit = canSubmitReview(applicationReviews);
  const balanceLabel = applicationReviewBalanceLabel(applicationReviews);
  const sorted = useMemo(
    () =>
      [...applicationReviews].sort(
        (a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)
      ),
    [applicationReviews]
  );

  if (!monthlyApplicationReviewLimit) return null;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    try {
      const text = await file.text();
      if (text?.trim()) {
        setContentText((prev) => (prev.trim() ? prev : text));
      }
    } catch {
      /* binary files: keep filename and require paste for content */
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!canSubmit) {
      setError("No application review credits remaining this billing cycle.");
      return;
    }
    if (!contentText.trim() && !fileName) {
      setError("Paste your draft or upload a file to submit a review request.");
      return;
    }

    setSubmitting(true);
    try {
      await submitApplicationReview({
        componentType,
        title: getComponentTypeLabel(componentType),
        contentText: contentText.trim(),
        fileName: fileName || null,
        studentNotes: studentNotes.trim(),
        mentorUserId: mentor?.userId || mentor?.mentorUserId || mentor?.mentorId || null
      });
      setContentText("");
      setFileName("");
      setStudentNotes("");
      setSuccess("Review request submitted.");
    } catch (err) {
      setError(err?.message || "Could not submit this review request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionCard title="Application component reviews" className="dash-panel dash-application-reviews">
      <p className="dash-muted dash-session-credit-balance" role="status">
        {balanceLabel || `${remaining} of ${monthlyApplicationReviewLimit} application reviews remaining`}
      </p>
      <p className="dash-muted">Each credit covers one application component.</p>

      <form className="dash-application-reviews__form" onSubmit={handleSubmit}>
        <div className="dash-session-category-picker" role="group" aria-label="Application component type">
          <p className="dash-session-category-picker__label">1. Select the type of application component</p>
          <div className="dash-session-category-picker__options dash-application-reviews__type-options">
            {APPLICATION_REVIEW_COMPONENT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                className={
                  componentType === type.id
                    ? "dash-session-category-picker__option dash-session-category-picker__option--selected"
                    : "dash-session-category-picker__option"
                }
                onClick={() => setComponentType(type.id)}
              >
                <strong>{type.label}</strong>
                <span>{type.description}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="dash-application-reviews__field">
          <span>2. Upload a file or paste text</span>
          <textarea
            value={contentText}
            onChange={(event) => setContentText(event.target.value)}
            rows={8}
            placeholder="Paste your essay, activities list, résumé text, school list, or other component here…"
          />
        </label>

        <label className="dash-application-reviews__file">
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>{fileName || "Choose a file (optional)"}</span>
          <input type="file" accept=".txt,.md,.rtf,.csv,.doc,.docx,.pdf" onChange={handleFileChange} />
        </label>

        <label className="dash-application-reviews__field">
          <span>3. Notes or questions for your mentor</span>
          <textarea
            value={studentNotes}
            onChange={(event) => setStudentNotes(event.target.value)}
            rows={3}
            placeholder="What should your mentor focus on?"
          />
        </label>

        {!canSubmit ? (
          <p className="dash-plan-session-banner__meta" role="alert">
            No application review credits remaining this month. Unused credits do not roll over.
          </p>
        ) : null}
        {error ? (
          <p className="dash-plan-session-banner__meta" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="dash-muted" role="status">
            {success}
          </p>
        ) : null}

        <button type="submit" className="dash-btn dash-btn--primary" disabled={submitting || !canSubmit}>
          {submitting ? "Submitting…" : "4. Submit review request"}
        </button>
      </form>

      <div className="dash-application-reviews__history">
        <h3 className="dash-application-reviews__history-title">5. Track status</h3>
        {sorted.length ? (
          <ul className="dash-application-reviews__list">
            {sorted.map((review) => (
              <li key={review.id} className="dash-application-reviews__item">
                <div className="dash-application-reviews__item-head">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <div>
                    <p className="dash-application-reviews__item-title">{review.title || getComponentTypeLabel(review.componentType)}</p>
                    <p className="dash-muted">
                      Submitted{" "}
                      {review.submittedAt
                        ? new Date(review.submittedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })
                        : "—"}
                    </p>
                  </div>
                  <span className={`dash-review-status ${statusClass(review.status)}`}>
                    {getReviewStatusLabel(review.status)}
                  </span>
                </div>
                {review.feedbackText ? (
                  <div className="dash-application-reviews__feedback">
                    <p className="dash-application-reviews__feedback-label">Mentor feedback</p>
                    <p>{review.feedbackText}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            title="No review requests yet"
            description="Submit an application component above to use one of your monthly review credits."
          />
        )}
      </div>
    </SectionCard>
  );
}
