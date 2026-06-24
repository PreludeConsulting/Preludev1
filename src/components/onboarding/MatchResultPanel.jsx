import PreludeMentorCard from "../hero/PreludeMentorCard.jsx";

export default function MatchResultPanel({ mentor, loading, onAccept, onCompare, onDecline }) {
  return (
    <div className="pm-match-result">
      <header className="pm-match-result__head">
        <h2 className="pm-results__title">Your recommended mentor</h2>
        <p className="pm-results__sub">
          Based on your goals, interests, and preferred support style.
        </p>
      </header>

      <PreludeMentorCard mentor={{ ...mentor, bestMatch: true }} showAction={false} />

      <p className="pm-match-result__disclaimer">
        This recommendation is a starting point. Compare other mentors without changing it, or decline it
        if you know you want a different fit.
      </p>

      <div className="pm-match-result__actions">
        <button type="button" className="dash-btn dash-btn--primary" disabled={loading} onClick={onAccept}>
          {loading ? "Saving…" : "Accept & Continue"}
        </button>
        <button type="button" className="dash-btn dash-btn--secondary" disabled={loading} onClick={onCompare}>
          Compare Mentors
        </button>
        <button
          type="button"
          className="dash-btn dash-btn--secondary pm-match-result__decline"
          disabled={loading}
          onClick={onDecline}
        >
          Decline Recommendation
        </button>
      </div>
    </div>
  );
}
