import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useHoverSidebar } from "../hooks/useHoverSidebar.js";
import DashboardHeader from "./DashboardHeader.jsx";
import DashboardSidebar from "./DashboardSidebar.jsx";

export default function DashboardLayout({ navItems, basePath, routeMeta = {} }) {
  const { expanded, mobileOpen, setMobileOpen, onSidebarEnter, onSidebarLeave, onEdgeEnter } = useHoverSidebar();

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, setMobileOpen]);

  return (
    <div className="dash-shell dash-shell--hover-rail">
      <div className="dash-shell__grain pointer-events-none" aria-hidden="true" />
      <div className="dash-sidebar-edge hidden lg:block" onMouseEnter={onEdgeEnter} aria-hidden="true" />
      <DashboardSidebar
        navItems={navItems}
        basePath={basePath}
        mobileOpen={mobileOpen}
        expanded={expanded}
        onSidebarEnter={onSidebarEnter}
        onSidebarLeave={onSidebarLeave}
        onMobileClose={() => setMobileOpen(false)}
      />
      {mobileOpen ? (
        <button type="button" className="dash-sidebar-overlay lg:hidden" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      ) : null}

      <div className="dash-main">
        <DashboardHeader routeMeta={routeMeta} basePath={basePath} onMenuToggle={() => setMobileOpen((o) => !o)} />
        <main className="dash-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
