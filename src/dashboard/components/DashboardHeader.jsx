import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const profileRef = useRef(null);
  const segment = segmentFromPath(location.pathname);
  const studentDetailMatch = location.pathname.match(/\/students\/([^/]+)/);
  const metaKey = studentDetailMatch ? studentDetailMatch[1] : segment;
  const meta = routeMeta[metaKey] || routeMeta.overview || { title: "Dashboard", subtitle: "" };
  const roleLabel = user?.role ? `${user.role[0].toUpperCase()}${user.role.slice(1)}` : "Account";

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handleDocumentClick(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

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

        <div className="dash-topbar__profile-wrap" ref={profileRef}>
          <button
            type="button"
            className="dash-topbar__user"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={user?.name} />
            <span className="dash-topbar__user-text">
              <span className="dash-topbar__name">{user?.name || "Account"}</span>
              <DashBadge variant="soft">{roleLabel}</DashBadge>
            </span>
            <span className="dash-topbar__profile" aria-hidden="true">
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
          {profileOpen ? (
            <div className="dash-dropdown" role="menu">
              <NavLink to={`${basePath}/settings`} className="dash-dropdown__item" role="menuitem" onClick={() => setProfileOpen(false)}>
                Profile & settings
              </NavLink>
              <button
                type="button"
                className="dash-dropdown__item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  openAccount();
                }}
              >
                Account & plan
              </button>
              <button
                type="button"
                className="dash-dropdown__item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  signOut();
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
