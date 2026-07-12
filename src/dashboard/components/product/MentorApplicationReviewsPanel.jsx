import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  APPLICATION_REVIEW_STATUS,
  getComponentTypeLabel,
  getReviewStatusLabel
} from "../../../lib/applicationReviewData.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";

function statusClass(status) {
  if (status === APPLICATION_REVIEW_STATUS.COMPLETED) return "dash-review-status--completed";
  if (status === APPLICATION_REVIEW_STATUS.IN_REVIEW) return "dash-review-status--in-review";
  return "dash-review-status--submitted";
}

export default function MentorApplicationReviewsPanel({ studentFilter = "" }) {
  const { applicationReviews = [], updateApplicationReview } = useDashboardData();
  const [activeId, setActiveId] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [editedContentText, setEditedContentText] = useState("");
  const [editedFileName, setEditedFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reviews = useMemo(() => {
    const filtered = studentFilter
      ? applicationReviews.filter((review) => review.studentUserId === studentFilter)
      : applicationReviews;
    return [...filtered].sort(
      (a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)
    );
  }, [applicationReviews, studentFilter]);

  const active = reviews.find((review) => review.id === activeId) || null;
  const openCount = reviews.filter(
    (review) =>
      review.status === APPLICATION_REVIEW_STATUS.SUBMITTED ||
      review.status === APPLICATION_REVIEW_STATUS.IN_REVIEW
  ).length;

  if (!reviews.length) return null;

  function openReview(review) {
    setActiveId(review.id);
    setFeedbackText(review.feedbackText || "");
    setEditedContentText(review.editedContentText || "");
    setEditedFileName(review.editedFileName || "");
    setError("");
  }

  async function saveStatus(status) {
    if (!active) return;
    setSaving(true);
    setError("");
    try {
      await updateApplicationReview(active.id, {
        status,
        feedbackText,
        editedContentText,
        editedFileName: editedFileName || null
      });
      if (status === APPLICATION_REVIEW_STATUS.COMPLETED) {
        setActiveId(null);
      }
    } catch (err) {
      setError(err?.message || "Could not update this review request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="dash-product-card dash-product-card--mentor-requests" aria-label="Application review requests">
      <header className="dash-product-card__head dash-mentor-requests-panel__head">
        <div>
          <p className="dash-product-card__eyebrow">Reviews</p>
          <h3 className="dash-product-card__title">Application review requests</h3>
        </div>
        <span className="dash-mentor-requests-panel__count">{openCount} open</span>
      </header>

      <div className="dash-mentor-requests-panel__list">
        {reviews.map((review) => (
          <article key={review.id} className="dash-mentor-request-row">
            <div className="dash-mentor-request-row__main">
              <span className="dash-mentor-request-row__icon" aria-hidden="true">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="dash-mentor-request-row__name">{review.studentName || "Student"}</p>
                <p className="dash-mentor-request-row__meta">
                  {getComponentTypeLabel(review.componentType)} ·{" "}
                  <span className={`dash-review-status ${statusClass(review.status)}`}>
                    {getReviewStatusLabel(review.status)}
                  </span>
                </p>
              </div>
            </div>
            <div className="dash-mentor-request-row__actions">
              <button type="button" className="dash-btn dash-btn--sm dash-btn--secondary" onClick={() => openReview(review)}>
                Open
              </button>
            </div>
          </article>
        ))}
      </div>

      {active ? (
        <div className="dash-application-reviews__mentor-detail">
          <h4>{active.title || getComponentTypeLabel(active.componentType)}</h4>

          {active.studentNotes ? (
            <div className="dash-application-reviews__feedback">
              <p className="dash-application-reviews__feedback-label">Student notes</p>
              <p>{active.studentNotes}</p>
            </div>
          ) : null}

          <div className="dash-application-reviews__feedback">
            <p className="dash-application-reviews__feedback-label">
              Submitted content{active.fileName ? ` (${active.fileName})` : ""}
            </p>
            <pre className="dash-application-reviews__content">{active.contentText || "No text provided."}</pre>
          </div>

          <label className="dash-application-reviews__field">
            <span>Written feedback</span>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              rows={6}
              placeholder="Written comments, suggested edits, and clear next steps…"
            />
          </label>

          <label className="dash-application-reviews__field">
            <span>Edited file / revised text (optional)</span>
            <input
              type="text"
              value={editedFileName}
              onChange={(event) => setEditedFileName(event.target.value)}
              placeholder="Edited file name (optional)"
            />
            <textarea
              value={editedContentText}
              onChange={(event) => setEditedContentText(event.target.value)}
              rows={5}
              placeholder="Paste an edited version if helpful…"
            />
          </label>

          {error ? (
            <p className="dash-plan-session-banner__meta" role="alert">
              {error}
            </p>
          ) : null}

          <div className="dash-application-reviews__mentor-actions">
            <button
              type="button"
              className="dash-btn dash-btn--secondary dash-btn--sm"
              disabled={saving}
              onClick={() => saveStatus(APPLICATION_REVIEW_STATUS.IN_REVIEW)}
            >
              Mark In Review
            </button>
            <button
              type="button"
              className="dash-btn dash-btn--primary dash-btn--sm"
              disabled={saving || !feedbackText.trim()}
              onClick={() => saveStatus(APPLICATION_REVIEW_STATUS.COMPLETED)}
            >
              Mark Completed
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
