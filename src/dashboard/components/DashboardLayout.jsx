import { useEffect, useMemo, useState } from "react";
import { UserCheck } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import EmailVerificationBanner from "../../components/EmailVerificationBanner.jsx";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import ParentReminderBanner from "./ParentReminderBanner.jsx";
import { roleFromUser, PARENT_DASHBOARD_BASE } from "../../lib/dashboardRoutes.js";
import { applyPreferences } from "../lib/dashboardPreferences.js";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import CalendarReminderBootstrap from "./CalendarReminderBootstrap.jsx";
import DashboardProductNav from "./product/DashboardProductNav.jsx";
import PreludeFloatingChat from "./chat/PreludeFloatingChat.jsx";
import { PreludeChatProvider } from "../context/PreludeChatContext.jsx";
import { PlanUpgradeProvider } from "../context/PlanUpgradeContext.jsx";
import { MotionPage } from "../../components/motion/MotionPrimitives.jsx";
import { checkMatchingTeamAccess } from "../../lib/mentorSelectionApi.js";
import { hasMatchingTeamAccess } from "../../../shared/matchingTeamAccess.js";

export default function DashboardLayout({ navItems, basePath, productNav }) {
  const location = useLocation();
  const { user } = useAuth();
  const { error: dataError } = useDashboardData();
  const [showMatchingNav, setShowMatchingNav] = useState(false);
  const showVerifyBanner = Boolean(user && !user.emailVerified);
  const showParentReminder = roleFromUser(user) === "student";
  const showLanguageSwitcher = basePath === PARENT_DASHBOARD_BASE;
  const visibleNavItems = useMemo(() => {
    const items = productNav || navItems || [];
    if (!showMatchingNav) return items;
    if (items.some((item) => item.to === "/matching")) return items;
    return [...items, { to: "/matching", label: "Matching", icon: UserCheck }];
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
      const hasKnownMatchingAccess = hasMatchingTeamAccess(user);
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
              {dataError ? (
                <div className="dash-callout dash-callout--error" role="alert">
                  <p>{dataError}</p>
                </div>
              ) : null}
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
