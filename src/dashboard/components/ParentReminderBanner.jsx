import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { shouldUseDemoFixtures } from "../../lib/devAuthBypass.js";
import { studentHasParentInvites } from "../../lib/parentLinks.js";
import { settingsPathForRole } from "../../lib/onboardingRoutes.js";

const DISMISS_KEY = "prelude_parent_reminder_dismissed";

export default function ParentReminderBanner() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const settingsPath = `${settingsPathForRole(user?.role)}#family`;

  useEffect(() => {
    if (!user?.id || user.role !== "student" || shouldUseDemoFixtures(user)) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        if (sessionStorage.getItem(`${DISMISS_KEY}_${user.id}`) === "1") return;
        if (user.parentInviteStepComplete) return;
        const hasInvites = await studentHasParentInvites(user.id);
        if (!cancelled && !hasInvites) setVisible(true);
      } catch {
        /* ignore */
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!visible) return null;

  function dismiss() {
    sessionStorage.setItem(`${DISMISS_KEY}_${user.id}`, "1");
    setVisible(false);
  }

  return (
    <div className="dash-parent-reminder" role="status">
      <div className="dash-parent-reminder__inner">
        <Users className="h-5 w-5" aria-hidden="true" />
        <p>
          <strong>Don&apos;t forget to add your parents!</strong> Invite a parent or guardian to follow your progress on Prelude.
        </p>
        <Link to={settingsPath} className="dash-btn dash-btn--secondary dash-btn--sm" onClick={dismiss}>
          Add in Settings
        </Link>
        <button type="button" className="dash-parent-reminder__close" onClick={dismiss} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
