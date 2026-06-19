import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Mail, Plus, Users } from "lucide-react";
import { inviteParent, listParentInvites } from "../../../lib/parentLinks.js";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { SectionCard, SecondaryButton } from "../ui/index.jsx";

export default function ParentGuardianSettingsPanel({ user }) {
  const [invites, setInvites] = useState([]);
  const [parentEmail, setParentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    listParentInvites(user.id).then(setInvites).catch(() => setInvites([]));
  }, [user?.id]);

  async function handleInvite(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await inviteParent({
        studentId: user.id,
        studentName: user.name,
        parentEmail
      });
      const next = await listParentInvites(user.id);
      setInvites(next);
      setParentEmail("");
      setSuccess("Invitation sent. Your parent will receive an email with a link to join Prelude.");
    } catch (err) {
      setError(err.message || "Could not send invitation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard title="Parents &amp; guardians" className="dash-panel">
      <p className="dash-muted">
        Invite a parent or guardian to follow your progress. They get a simplified dashboard with calendar and summary views.
      </p>

      <form className="dash-parent-invite-form dash-parent-invite-form--settings" onSubmit={handleInvite}>
        <label className="prelude-field">
          <span>Parent email</span>
          <div className="dash-parent-invite-form__input-wrap">
            <Mail className="h-4 w-4" aria-hidden="true" />
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@example.com"
              required
            />
          </div>
        </label>
        <SecondaryButton type="submit" className="dash-btn--sm" disabled={loading}>
          <Plus className="h-4 w-4" aria-hidden="true" /> {loading ? "Sending…" : "Send invitation"}
        </SecondaryButton>
      </form>

      {error ? <p className="dash-delete-account__error">{error}</p> : null}
      {success ? (
        <p className="dash-save-state dash-save-state--ok">
          <Check className="h-4 w-4" aria-hidden="true" /> {success}
        </p>
      ) : null}

      {invites.length ? (
        <ul className="dash-parent-invite-list">
          {invites.map((invite) => (
            <li key={invite.id} className="dash-parent-invite-list__item">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>{invite.parent_email}</span>
              <span className={`dash-badge dash-badge--${invite.status === "accepted" ? "soft" : "lavender"}`}>
                {invite.status === "accepted" ? "Connected" : "Invited"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dash-muted">No parent invitations yet.</p>
      )}

      <p className="dash-muted dash-parent-invite-settings__hint">
        Manage invitations anytime from{" "}
        <Link to={`${STUDENT_DASHBOARD_BASE}/settings`}>Settings → Family</Link>.
      </p>
    </SectionCard>
  );
}
