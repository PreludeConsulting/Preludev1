import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { listGlobalMentorNetwork } from "../../../lib/mentorNetworkApi.js";
import { subscribeMentorNetworkProfiles } from "../../../lib/mentorQuestionnaireService.js";
import { SearchInput, PrimaryButton } from "../ui/index.jsx";
import MentorMessagingLockPanel from "./MentorMessagingLockPanel.jsx";
import DashboardMentorNetworkCard, { mentorMatchesQuery } from "./DashboardMentorNetworkCard.jsx";

export default function MessagesMentorNetworkPanel({ canMessage, onBack, onMessageMentor }) {
  const [mentors, setMentors] = useState([]);
  const [eligible, setEligible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [messagingId, setMessagingId] = useState(null);
  const [messageError, setMessageError] = useState("");

  const loadMentors = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await listGlobalMentorNetwork();
      setMentors(result.mentors);
      setEligible(result.eligible);
      setLoadError(result.error || "");
    } catch (error) {
      setMentors([]);
      setLoadError(error?.message || "Could not load the mentor network.");
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    loadMentors();
    // Mentor profile/availability edits should surface without a manual reload.
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
  const locked = !canMessage || !eligible;

  const handleMessage = useCallback(
    async (mentorId) => {
      if (!onMessageMentor || messagingId) return;
      setMessageError("");
      setMessagingId(mentorId);
      const result = await onMessageMentor(mentorId);
      setMessagingId(null);
      if (result && result.ok === false) {
        setMessageError(result.error || "Could not open this conversation.");
      }
    },
    [onMessageMentor, messagingId]
  );

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
            <DashboardMentorNetworkCard mentor={selected} expanded locked={locked} />
            {!locked ? (
              <div className="dash-chat-network__message-cta">
                <p className="dash-muted">
                  Start a conversation with {selected.name.split(" ")[0]} from your Prelude mentor network.
                </p>
                <PrimaryButton
                  type="button"
                  className="dash-btn--sm"
                  disabled={messagingId === selected.id}
                  onClick={() => handleMessage(selected.id)}
                >
                  <MessageCircle className="h-4 w-4" />{" "}
                  {messagingId === selected.id ? "Opening…" : "Message mentor"}
                </PrimaryButton>
                {messageError ? (
                  <p className="dash-muted" role="alert">
                    {messageError}
                  </p>
                ) : null}
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
            {locked
              ? "Mentor Network is available with Plus or Pro."
              : "The Prelude mentors you can browse and message."}
          </span>
        </div>
      </header>

      {locked ? (
        <div className="dash-chat-network__results">
          <MentorMessagingLockPanel />
        </div>
      ) : (
        <>
          <div className="dash-chat-network__toolbar">
            <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your mentors…" />
          </div>

          <div className="dash-chat-network__results">
            <div className="dash-chat-network__grid">
              {loading ? (
                Array.from({ length: 3 }, (_, index) => (
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
              ) : loadError ? (
                <p className="dash-muted dash-chat-network__empty" role="alert">
                  We could not load your mentor network. Please try again.
                </p>
              ) : filtered.length ? (
                filtered.map((mentor) => (
                  <DashboardMentorNetworkCard
                    key={mentor.id}
                    mentor={mentor}
                    locked={locked}
                    onViewProfile={() => setSelectedId(mentor.id)}
                  />
                ))
              ) : mentors.length ? (
                <p className="dash-muted dash-chat-network__empty">No mentors match your search.</p>
              ) : (
                <p className="dash-muted dash-chat-network__empty">
                  Mentors will appear here once your Prelude admin adds them to the mentor network.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
