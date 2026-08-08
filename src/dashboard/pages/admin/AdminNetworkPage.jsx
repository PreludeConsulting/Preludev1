import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { loadMatchingTeamQueue } from "../../../lib/mentorSelectionApi.js";
import {
  adminAddNetworkMember,
  adminListNetworkMembers,
  adminRemoveNetworkMember
} from "../../../lib/mentorNetworkApi.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function displayList(value, fallback = "Not provided") {
  const items = asArray(value);
  if (!items.length) return fallback;
  return items
    .map((item) => (typeof item === "string" ? item : item?.name || item?.label || String(item)))
    .join(", ");
}

function AdminNetworkMentorCard({ mentor, inNetwork, saving, onAdd, onRemove }) {
  return (
    <article className={`matching-team-mentor-card${inNetwork ? " matching-team-mentor-card--selected" : ""}`}>
      <div className="matching-team-mentor-card__head">
        <div className="matching-team-mentor-card__avatar">{mentor.initials || "M"}</div>
        <div>
          <h4>{mentor.name}</h4>
          <p>{[mentor.school, mentor.major].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      {mentor.bio ? <p className="matching-team-mentor-card__bio">{mentor.bio}</p> : null}
      <dl className="matching-team-mentor-card__facts">
        <div><dt>Strengths</dt><dd>{displayList(mentor.applicationStrengths || mentor.specialties)}</dd></div>
        <div><dt>Style</dt><dd>{displayList(mentor.supportStyles)}</dd></div>
        <div><dt>Targets</dt><dd>{displayList(mentor.targetMajors)}</dd></div>
        <div><dt>Availability</dt><dd>{mentor.availability || "Not provided"}</dd></div>
      </dl>
      {[...(mentor.specialties || []), ...(mentor.targetSchools || [])].length ? (
        <div className="matching-team-mentor-card__pills">
          {[...(mentor.specialties || []), ...(mentor.targetSchools || [])].slice(0, 4).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {inNetwork ? (
        <div className="matching-team-mentor-card__network-actions">
          <span className="matching-team-status matching-team-status--matched">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> In Network
          </span>
          <button
            type="button"
            className="dash-btn dash-btn--secondary dash-btn--sm"
            disabled={saving}
            onClick={() => onRemove(mentor.id)}
          >
            {saving ? "Removing…" : "Remove from Network"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="dash-btn dash-btn--primary dash-btn--sm"
          disabled={saving}
          onClick={() => onAdd(mentor.id)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> {saving ? "Adding…" : "Add to Network"}
        </button>
      )}
    </article>
  );
}

export default function AdminNetworkPage() {
  const [mentors, setMentors] = useState([]);
  const [memberIds, setMemberIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingMentorId, setSavingMentorId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [queue, members] = await Promise.all([
          loadMatchingTeamQueue(),
          adminListNetworkMembers()
        ]);
        if (cancelled) return;
        setMentors(queue.mentors || []);
        if (members.error) {
          setError(members.error);
        } else {
          setMemberIds(members.mentorIds);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load Network data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const memberIdSet = useMemo(() => new Set(memberIds), [memberIds]);
  const inNetworkCount = memberIdSet.size;

  async function handleAdd(mentorId) {
    setSavingMentorId(mentorId);
    setError("");
    setMessage("");
    const result = await adminAddNetworkMember(mentorId);
    setSavingMentorId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    setMemberIds(result.mentorIds);
    setMessage("Mentor added to the Mentor Network.");
  }

  async function handleRemove(mentorId) {
    setSavingMentorId(mentorId);
    setError("");
    setMessage("");
    const result = await adminRemoveNetworkMember(mentorId);
    setSavingMentorId("");
    if (result.error) {
      setError(result.error);
      return;
    }
    setMemberIds(result.mentorIds);
    setMessage("Mentor removed from the Mentor Network.");
  }

  if (loading) return <div className="dash-loading">Loading Mentor Network…</div>;

  return (
    <section className="matching-team-page dash-page dash-page--premium">
      <header className="matching-team-hero">
        <div>
          <p className="dash-eyebrow">Private internal tool</p>
          <h1 className="dash-page-title">Mentor Network</h1>
          <p className="dash-page-sub">
            Manage which Prelude mentors Plus and Pro students can connect with.
          </p>
        </div>
        <div className="matching-team-hero__stat">
          <strong>{error && !mentors.length ? "—" : `${inNetworkCount}/${mentors.length}`}</strong>
          <span>in Mentor Network</span>
        </div>
      </header>

      {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}
      {message ? <p className="pm-match-result__saved" role="status">{message}</p> : null}

      <div className="matching-team-list">
        <article className="matching-team-card dash-panel">
          <div className="matching-team-card__top">
            <div>
              <div className="matching-team-card__title-row">
                <h2>Prelude mentors</h2>
                <span className="matching-team-status matching-team-status--matched">
                  {inNetworkCount} in Network
                </span>
              </div>
              <p>
                This is one global Mentor Network. Every eligible Plus or Pro student sees the same
                mentors. Details are pulled live from each mentor&apos;s current profile.
              </p>
            </div>
          </div>

          {mentors.length ? (
            <section className="matching-team-mentor-panel">
              <div className="matching-team-mentor-grid">
                {mentors.map((mentor) => (
                  <AdminNetworkMentorCard
                    key={mentor.id}
                    mentor={mentor}
                    inNetwork={memberIdSet.has(mentor.id)}
                    saving={savingMentorId === mentor.id}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="dash-empty">No Prelude mentors are available yet.</div>
          )}
        </article>
      </div>
    </section>
  );
}
