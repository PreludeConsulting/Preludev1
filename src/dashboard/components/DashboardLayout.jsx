import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import EmailVerificationBanner from "../../components/EmailVerificationBanner.jsx";
import { applyPreferences } from "../lib/dashboardPreferences.js";
import CalendarReminderBootstrap from "./CalendarReminderBootstrap.jsx";
import DashboardProductNav from "./product/DashboardProductNav.jsx";

export default function DashboardLayout({ navItems, basePath, productNav }) {
  const { user } = useAuth();
  const showVerifyBanner = Boolean(user && !user.emailVerified);

  useEffect(() => {
    applyPreferences();
  }, []);

  return (
    <div className={`dash-shell dash-shell--product${showVerifyBanner ? " dash-shell--verify-banner" : ""}`}>
      <CalendarReminderBootstrap />
      <div className="dash-shell__grain pointer-events-none" aria-hidden="true" />
      <div className="dash-product-canvas">
        <div className="dash-product-frame">
          <DashboardProductNav navItems={productNav || navItems} basePath={basePath} />
          <main className="dash-product-main">
            <Outlet />
          </main>
        </div>
      </div>
      {showVerifyBanner ? <EmailVerificationBanner /> : null}
    </div>
  );
}
