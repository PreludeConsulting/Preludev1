import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { cn } from "../../lib/utils.js";
import { Avatar, DashBadge, IconButton } from "./ui/index.jsx";

function segmentFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "overview";
}

export default function DashboardHeader({ routeMeta, basePath, onMenuToggle }) {
  const { user, signOut, openAccount } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const segment = segmentFromPath(location.pathname);
  const studentDetailMatch = location.pathname.match(/\/students\/([^/]+)/);
  const metaKey = studentDetailMatch ? studentDetailMatch[1] : segment;
  const meta = routeMeta[metaKey] || routeMeta.overview || { title: "Dashboard", subtitle: "" };
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";

  return (
    <header className={cn("dash-topbar", "dash-topbar--slim", !meta.subtitle && "dash-topbar--compact")}>
      <button type="button" className="dash-topbar__menu lg:hidden" onClick={onMenuToggle} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="dash-topbar__titles">
        <h1 className={cn("dash-topbar__page-title", metaKey === "overview" && "shopify-hero__headline dash-page-title")}>{meta.title}</h1>
        {meta.subtitle ? <p className="dash-topbar__page-subtitle">{meta.subtitle}</p> : null}
      </div>

      <div className="dash-topbar__actions">
        <IconButton label="Search" className="dash-topbar__action">
          <Search className="h-5 w-5" />
        </IconButton>
        <IconButton label="Notifications" className="dash-topbar__action">
          <Bell className="h-5 w-5" />
        </IconButton>

        <div className="dash-topbar__user">
          <Avatar name={user?.name} />
          <div className="dash-topbar__user-text">
            <p className="dash-topbar__name">{user?.name}</p>
            <DashBadge variant="soft">{roleLabel}</DashBadge>
          </div>
          <div className="dash-topbar__profile-wrap">
            <button type="button" className="dash-topbar__profile" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen}>
              <ChevronDown className="h-4 w-4" />
            </button>
            {profileOpen ? (
              <div className="dash-dropdown">
                <NavLink to={`${basePath}/profile`} className="dash-dropdown__item" onClick={() => setProfileOpen(false)}>
                  Profile & settings
                </NavLink>
                <button type="button" className="dash-dropdown__item" onClick={openAccount}>
                  Account & plan
                </button>
                <button type="button" className="dash-dropdown__item" onClick={() => signOut()}>
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
