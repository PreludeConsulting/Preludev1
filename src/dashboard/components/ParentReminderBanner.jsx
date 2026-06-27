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
    <div className="dash-parent-reminder" role="status" aria-live="polite">
      <div className="dash-parent-reminder__inner">
        <div className="dash-parent-reminder__icon" aria-hidden="true">
          <Users className="h-5 w-5" />
        </div>
        <div className="dash-parent-reminder__content">
          <p className="dash-parent-reminder__title">Don&apos;t forget to add your parents!</p>
          <p className="dash-parent-reminder__body">
            Invite a parent or guardian to follow your progress on Prelude.
          </p>
        </div>
        <button type="button" className="dash-parent-reminder__close" onClick={dismiss} aria-label="Dismiss reminder">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link to={settingsPath} className="dash-parent-reminder__cta" onClick={dismiss}>
          Add in Settings
        </Link>
      </div>
    </div>
  );
}
