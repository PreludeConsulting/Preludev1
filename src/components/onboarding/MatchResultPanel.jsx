import PreludeMentorCard from "../hero/PreludeMentorCard.jsx";

export default function MatchResultPanel({ mentor, loading, onAccept, onDecline }) {
  return (
    <div className="pm-match-result">
      <header className="pm-match-result__head">
        <h2 className="pm-results__title">Your recommended mentor</h2>
        <p className="pm-results__sub">
          Based on your goals, interests, and preferred support style.
        </p>
      </header>

      <PreludeMentorCard mentor={{ ...mentor, bestMatch: true }} />

      <p className="pm-match-result__disclaimer">
        Your match is only a recommendation. If this mentor does not feel like the right fit, you can
        decline the match and browse other mentors before making a decision.
      </p>

      <div className="pm-match-result__actions">
        <button type="button" className="dash-btn dash-btn--primary" disabled={loading} onClick={onAccept}>
          {loading ? "Saving…" : "Accept Match"}
        </button>
        <button type="button" className="dash-btn dash-btn--secondary" disabled={loading} onClick={onDecline}>
          Decline and View Other Mentors
        </button>
      </div>
    </div>
  );
}
