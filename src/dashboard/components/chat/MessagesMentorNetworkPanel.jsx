import { useMemo, useState } from "react";
import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import PreludeMentorCard from "../../../components/hero/PreludeMentorCard.jsx";
import { getMentorCatalog } from "../../../lib/preludeMatchService.js";
import { SearchInput, PrimaryButton } from "../ui/index.jsx";
import PlanLockedFeature from "../product/PlanLockedFeature.jsx";

export default function MessagesMentorNetworkPanel({ canMessage, onBack }) {
  const mentors = getMentorCatalog();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return mentors;
    const needle = query.trim().toLowerCase();
    return mentors.filter((mentor) => {
      const hay = `${mentor.name} ${mentor.school || mentor.university} ${mentor.major} ${(mentor.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [mentors, query]);

  const selected = selectedId ? mentors.find((mentor) => mentor.id === selectedId) : null;

  if (selected) {
    return (
      <div className="dash-chat-network">
        <header className="dash-chat-network__header">
          <button type="button" className="dash-chat-app__back" onClick={() => setSelectedId(null)} aria-label="Back to network">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="dash-chat-network__header-copy">
            <strong>{selected.name}</strong>
            <span>{selected.school || selected.university} · {selected.major}</span>
          </div>
        </header>

        <div className="dash-chat-network__detail">
          <PreludeMentorCard mentor={selected} showAction={false} />
          {canMessage ? (
            <div className="dash-chat-network__message-cta">
              <p className="dash-muted">Start a conversation with {selected.name.split(" ")[0]} across the Prelude mentor network.</p>
              <PrimaryButton type="button" className="dash-btn--sm">
                <MessageCircle className="h-4 w-4" /> Message mentor
              </PrimaryButton>
            </div>
          ) : (
            <PlanLockedFeature feature="fullMentorNetworkMessaging" compact actionLabel="Upgrade Plan" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dash-chat-network">
      <header className="dash-chat-network__header">
        <button type="button" className="dash-chat-app__back lg:hidden" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="dash-chat-network__header-copy">
          <strong>Mentor network</strong>
          <span>Browse mentors across Prelude. {canMessage ? "Message anyone on Plus or Pro." : "Upgrade to Plus to message network mentors."}</span>
        </div>
      </header>

      <div className="dash-chat-network__toolbar">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mentors…" />
      </div>

      <div className="dash-chat-network__grid">
        {filtered.length ? (
          filtered.map((mentor) => (
            <button
              key={mentor.id}
              type="button"
              className="dash-chat-network__card-btn"
              onClick={() => setSelectedId(mentor.id)}
            >
              <PreludeMentorCard mentor={mentor} showAction={false} />
              <span className="dash-chat-network__card-action">
                View profile
                {!canMessage ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </span>
            </button>
          ))
        ) : (
          <p className="dash-muted dash-chat-network__empty">No mentors match your search.</p>
        )}
      </div>
    </div>
  );
}
