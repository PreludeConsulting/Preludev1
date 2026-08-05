import { useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldCheck, X } from "lucide-react";
import {
  listMentorProfileApprovals,
  setMentorProfileApproval
} from "../../../lib/adminMentorApprovalService.js";

function profileStatus(profile) {
  if (profile.approved) return "approved";
  if (profile.completed) return "pending";
  return "incomplete";
}

function statusLabel(profile) {
  const status = profileStatus(profile);
  if (status === "approved") return "Approved";
  if (status === "pending") return "Ready for review";
  return "Onboarding incomplete";
}

export default function MentorApprovalsAdminPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("pending");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const next = await listMentorProfileApprovals();
        if (!cancelled) setProfiles(next);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load mentor profiles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (filter !== "all" && profileStatus(profile) !== filter) return false;
      if (!needle) return true;
      return [
        profile.displayName,
        profile.college,
        profile.major,
        profile.bio,
        ...(profile.specialties || [])
      ].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [filter, profiles, query]);

  async function updateApproval(profile, approved) {
    if (!approved && !window.confirm(`Remove ${profile.displayName || "this mentor"} from the student mentor network?`)) {
      return;
    }

    setSavingId(profile.mentorUserId);
    setError("");
    setMessage("");
    try {
      const updated = await setMentorProfileApproval(profile.mentorUserId, approved);
      setProfiles((current) => current.map((item) => (
        item.mentorUserId === profile.mentorUserId
          ? { ...item, approved: updated.approved, approvedAt: updated.approvedAt, updatedAt: updated.updatedAt }
          : item
      )));
      setMessage(approved
        ? `${profile.displayName || "Mentor"} is now visible in the student mentor network.`
        : `${profile.displayName || "Mentor"} was removed from the student mentor network.`);
    } catch (err) {
      setError(err.message || "Could not update mentor approval.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="mentor-approvals-page dash-page dash-page--premium">
      <header className="matching-team-hero">
        <div>
          <p className="dash-eyebrow">Private internal tool</p>
          <h1 className="dash-page-title">Mentor approvals</h1>
          <p className="dash-page-sub">
            Review completed mentor profiles before publishing them to the student mentor network.
          </p>
        </div>
        <div className="matching-team-hero__stat">
          <strong>{profiles.filter((profile) => profile.completed && !profile.approved).length}</strong>
          <span>awaiting review</span>
        </div>
      </header>

      <section className="mentor-approvals-toolbar dash-panel">
        <label className="matching-team-search mentor-approvals-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mentors, majors, or specialties..."
          />
        </label>
        <label className="mentor-approvals-filter">
          <span>Status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="pending">Ready for review</option>
            <option value="approved">Approved</option>
            <option value="incomplete">Onboarding incomplete</option>
            <option value="all">All mentors</option>
          </select>
        </label>
      </section>

      {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}
      {message ? <p className="pm-match-result__saved" role="status">{message}</p> : null}
      {loading ? <div className="dash-loading">Loading mentor profiles…</div> : null}

      {!loading ? (
        <div className="mentor-approvals-grid">
          {filteredProfiles.map((profile) => {
            const status = profileStatus(profile);
            const saving = savingId === profile.mentorUserId;
            return (
              <article key={profile.mentorUserId} className="mentor-approval-card dash-panel">
                <div className="mentor-approval-card__identity">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="mentor-approval-card__avatar" />
                  ) : (
                    <div className="mentor-approval-card__avatar mentor-approval-card__avatar--empty">
                      {(profile.displayName || "M").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="mentor-approval-card__title">
                      <h2>{profile.displayName || "Unnamed mentor"}</h2>
                      <span className={`mentor-approval-status mentor-approval-status--${status}`}>
                        {statusLabel(profile)}
                      </span>
                    </div>
                    <p>{[profile.college, profile.major].filter(Boolean).join(" · ") || "Program not provided"}</p>
                  </div>
                </div>

                {profile.bio ? <p className="mentor-approval-card__bio">{profile.bio}</p> : null}
                <div className="mentor-approval-card__specialties">
                  {(profile.specialties || []).map((specialty) => <span key={specialty}>{specialty}</span>)}
                </div>

                <div className="mentor-approval-card__actions">
                  {profile.approved ? (
                    <button
                      type="button"
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                      disabled={saving}
                      onClick={() => updateApproval(profile, false)}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      {saving ? "Removing…" : "Remove approval"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="dash-btn dash-btn--primary dash-btn--sm"
                      disabled={saving || !profile.completed}
                      onClick={() => updateApproval(profile, true)}
                    >
                      {profile.completed
                        ? <Check className="h-4 w-4" aria-hidden="true" />
                        : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                      {saving ? "Approving…" : profile.completed ? "Approve mentor" : "Complete onboarding first"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !filteredProfiles.length ? (
        <div className="dash-empty">No mentor profiles match this view.</div>
      ) : null}
    </section>
  );
}
