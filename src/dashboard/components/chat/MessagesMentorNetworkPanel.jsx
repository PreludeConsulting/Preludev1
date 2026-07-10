import { useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getMentorCatalog } from "../../../lib/preludeMatchService.js";
import { SearchInput, PrimaryButton } from "../ui/index.jsx";
import MentorMessagingLockPanel from "./MentorMessagingLockPanel.jsx";
import DashboardMentorNetworkCard, { mentorMatchesQuery } from "./DashboardMentorNetworkCard.jsx";

export default function MessagesMentorNetworkPanel({ canMessage, onBack }) {
  const mentors = getMentorCatalog();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return mentors.filter((mentor) => mentorMatchesQuery(mentor, needle));
  }, [mentors, query]);

  const selected = selectedId ? mentors.find((mentor) => mentor.id === selectedId) : null;

  if (selected) {
    const school = selected.school || selected.university || "";
    const headerMeta = [school, selected.major].filter(Boolean).join(" · ");

    return (
      <div className="dash-chat-network">
        <header className="dash-chat-network__header">
          <button type="button" className="dash-chat-app__back" onClick={() => setSelectedId(null)} aria-label="Back to network">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="dash-chat-network__header-copy">
            <strong>{selected.name}</strong>
            {headerMeta ? <span>{headerMeta}</span> : null}
          </div>
        </header>

        <div className="dash-chat-network__results">
          <div className="dash-chat-network__detail">
            <DashboardMentorNetworkCard mentor={selected} expanded locked={!canMessage} />
            {canMessage ? (
              <div className="dash-chat-network__message-cta">
                <p className="dash-muted">
                  Start a conversation with {selected.name.split(" ")[0]} across the Prelude mentor network.
                </p>
                <PrimaryButton type="button" className="dash-btn--sm">
                  <MessageCircle className="h-4 w-4" /> Message mentor
                </PrimaryButton>
              </div>
            ) : (
              <MentorMessagingLockPanel />
            )}
          </div>
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
          <span>
            Browse mentors across Prelude.{" "}
            {canMessage ? "Message anyone on Plus or Pro." : "Upgrade to Plus to message network mentors."}
          </span>
        </div>
      </header>

      <div className="dash-chat-network__toolbar">
        <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mentors…" />
      </div>

      <div className="dash-chat-network__results">
        <div className="dash-chat-network__grid">
          {filtered.length ? (
            filtered.map((mentor) => (
              <DashboardMentorNetworkCard
                key={mentor.id}
                mentor={mentor}
                locked={!canMessage}
                onViewProfile={() => setSelectedId(mentor.id)}
              />
            ))
          ) : (
            <p className="dash-muted dash-chat-network__empty">No mentors match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
