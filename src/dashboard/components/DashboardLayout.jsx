import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import EmailVerificationBanner from "../../components/EmailVerificationBanner.jsx";
import ParentReminderBanner from "./ParentReminderBanner.jsx";
import { roleFromUser } from "../../lib/dashboardRoutes.js";
import { applyPreferences } from "../lib/dashboardPreferences.js";
import { useDashboardData } from "../context/DashboardDataContext.jsx";
import CalendarReminderBootstrap from "./CalendarReminderBootstrap.jsx";
import DashboardProductNav from "./product/DashboardProductNav.jsx";
import PreludeFloatingChat from "./chat/PreludeFloatingChat.jsx";
import { PreludeChatProvider } from "../context/PreludeChatContext.jsx";
import { MotionPage } from "../../components/motion/MotionPrimitives.jsx";

export default function DashboardLayout({ navItems, basePath, productNav }) {
  const location = useLocation();
  const { user } = useAuth();
  const { error: dataError } = useDashboardData();
  const showVerifyBanner = Boolean(user && !user.emailVerified);
  const showParentReminder = roleFromUser(user) === "student";

  useEffect(() => {
    applyPreferences();
  }, []);

  return (
    <PreludeChatProvider>
      <div className={`dash-shell dash-shell--product${showVerifyBanner ? " dash-shell--verify-banner" : ""}`}>
        <CalendarReminderBootstrap />
        <div className="dash-shell__grain pointer-events-none" aria-hidden="true" />
        <div className="dash-product-canvas">
          <div className="dash-product-frame">
            <DashboardProductNav navItems={productNav || navItems} basePath={basePath} />
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
        <PreludeFloatingChat />
      </div>
    </PreludeChatProvider>
  );
}
