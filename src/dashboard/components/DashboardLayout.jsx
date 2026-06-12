import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { applyPreferences } from "../lib/dashboardPreferences.js";
import CalendarReminderBootstrap from "./CalendarReminderBootstrap.jsx";
import DashboardProductNav from "./product/DashboardProductNav.jsx";

export default function DashboardLayout({ navItems, basePath, productNav }) {
  useEffect(() => {
    applyPreferences();
  }, []);

  return (
    <div className="dash-shell dash-shell--product">
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
    </div>
  );
}
