import { useEffect, useMemo, useState } from "react";
import { Network, UserCheck } from "lucide-react";
import { Outlet, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext.jsx";
import EmailVerificationBanner from "../../components/EmailVerificationBanner.jsx";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import ParentReminderBanner from "./ParentReminderBanner.jsx";
import { roleFromUser, PARENT_DASHBOARD_BASE } from "../../lib/dashboardRoutes.js";
import { applyPreferences } from "../lib/dashboardPreferences.js";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import CalendarReminderBootstrap from "./CalendarReminderBootstrap.jsx";
import DashboardProductNav from "./product/DashboardProductNav.jsx";
import DataSyncBanner from "./DataSyncBanner.jsx";
import PreludeFloatingChat from "./chat/PreludeFloatingChat.jsx";
import { PreludeChatProvider } from "../context/PreludeChatContext.jsx";
import { PlanUpgradeProvider } from "../context/PlanUpgradeContext.jsx";
import { MotionPage } from "../../components/motion/MotionPrimitives.jsx";
import { checkMatchingTeamAccess } from "../../lib/mentorSelectionApi.js";
import { hasMatchingTeamAccess } from "../../../shared/matchingTeamAccess.js";

export default function DashboardLayout({ navItems, basePath, productNav }) {
  const location = useLocation();
  const { user } = useAuth();
  const { error: dataError, dashboardSyncState, refresh } = useDashboardData();
  const [showMatchingNav, setShowMatchingNav] = useState(false);
  const showVerifyBanner = Boolean(user && !user.emailVerified);
  const showParentReminder = roleFromUser(user) === "student";
  const showLanguageSwitcher = basePath === PARENT_DASHBOARD_BASE;
  const visibleNavItems = useMemo(() => {
    const items = productNav || navItems || [];
    // Matching + Network are gated by the same matching-team/admin access. When
    // the nav does not already include them (e.g. the mentor MENTOR_NAV), append
    // them so Network sits directly to the right of Matching. Regular mentors and
    // students never reach this branch, so they never see either tab.
    if (!showMatchingNav) return items;
    const hasMatching = items.some((item) => item.to === "/matching");
    const hasNetwork = items.some((item) => item.to === "/network");
    if (hasMatching && hasNetwork) return items;
    const next = [...items];
    if (!hasMatching) next.push({ to: "/matching", label: "Matching", icon: UserCheck });
    if (!hasNetwork) next.push({ to: "/network", label: "Network", icon: Network });
    return next;
  }, [navItems, productNav, showMatchingNav]);

  useEffect(() => {
    applyPreferences();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatchingAccess() {
      if (!user) {
        setShowMatchingNav(false);
        return;
      }
      const userRole = roleFromUser(user);
      const canShowMatchingForRole = userRole === "mentor" || userRole === "admin";
      const hasKnownMatchingAccess =
        Boolean(user?.matchingTeamAccess) || hasMatchingTeamAccess(user);
      if (!canShowMatchingForRole) {
        setShowMatchingNav(false);
        return;
      }
      if (hasKnownMatchingAccess) {
        setShowMatchingNav(true);
        return;
      }
      try {
        await checkMatchingTeamAccess();
        if (!cancelled) setShowMatchingNav(true);
      } catch {
        if (!cancelled) setShowMatchingNav(false);
      }
    }
    loadMatchingAccess();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <PreludeChatProvider>
      <PlanUpgradeProvider>
      <div className={`dash-shell dash-shell--product${showVerifyBanner ? " dash-shell--verify-banner" : ""}`}>
        <CalendarReminderBootstrap />
        <div className="dash-shell__grain pointer-events-none" aria-hidden="true" />
        <div className="dash-product-canvas">
          <div className="dash-product-frame">
            <DashboardProductNav navItems={visibleNavItems} basePath={basePath} />
            <main className="dash-product-main">
              <DataSyncBanner
                syncState={
                  dashboardSyncState?.status === "failed"
                    ? dashboardSyncState
                    : dataError
                      ? { status: "failed", error: dataError }
                      : null
                }
                onRetry={refresh}
              />
              <MotionPage key={location.pathname}>
                <Outlet />
              </MotionPage>
            </main>
          </div>
        </div>
        {showVerifyBanner ? <EmailVerificationBanner /> : null}
        {showParentReminder ? <ParentReminderBanner /> : null}
        {showLanguageSwitcher ? <LanguageSwitcher /> : null}
        <PreludeFloatingChat />
      </div>
      </PlanUpgradeProvider>
    </PreludeChatProvider>
  );
}
