import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import {
  listMentorNetworkProfiles,
  subscribeMentorNetworkProfiles
} from "../../../lib/mentorQuestionnaireService.js";
import { SearchInput, PrimaryButton } from "../ui/index.jsx";
import MentorMessagingLockPanel from "./MentorMessagingLockPanel.jsx";
import DashboardMentorNetworkCard, { mentorMatchesQuery } from "./DashboardMentorNetworkCard.jsx";

export default function MessagesMentorNetworkPanel({ canMessage, onBack }) {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const loadMentors = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await listMentorNetworkProfiles();
      setMentors(result.mentors);
      setLoadError(result.error || "");
    } catch (error) {
      setMentors([]);
      setLoadError(error?.message || "Could not load mentors.");
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadMentors();
    try {
      return subscribeMentorNetworkProfiles(() => loadMentors({ silent: true }));
    } catch {
      return undefined;
    }
  }, [loadMentors]);

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
          {loading || (!mentors.length && !loadError) ? (
            Array.from({ length: 6 }, (_, index) => (
              <div
                key={`mentor-placeholder-${index}`}
                className="dash-chat-network-card dash-chat-network-card--placeholder"
                aria-hidden="true"
              >
                <div className="dash-chat-network-card__media dash-skeleton" />
                <div className="dash-chat-network-card__body">
                  <span className="dash-chat-network-card__placeholder-line dash-skeleton" />
                  <span className="dash-chat-network-card__placeholder-line dash-chat-network-card__placeholder-line--short dash-skeleton" />
                  <span className="dash-chat-network-card__placeholder-tag dash-skeleton" />
                </div>
              </div>
            ))
          ) : filtered.length ? (
            filtered.map((mentor) => (
              <DashboardMentorNetworkCard
                key={mentor.id}
                mentor={mentor}
                locked={!canMessage}
                onViewProfile={() => setSelectedId(mentor.id)}
              />
            ))
          ) : loadError ? (
            <p className="dash-muted dash-chat-network__empty" role="alert">
              We could not load the mentor network. Please try again.
            </p>
          ) : (
            <p className="dash-muted dash-chat-network__empty">No mentors match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}
