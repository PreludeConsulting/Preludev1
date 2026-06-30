import { Bell, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogOut, Menu, Search, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { cn } from "../../lib/utils.js";
import { Avatar, IconButton } from "./ui/index.jsx";

function segmentFromPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "overview";
}

export default function DashboardHeader({ routeMeta, basePath, onMenuToggle }) {
  const { user, signOut, planDetails } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const segment = segmentFromPath(location.pathname);
  const studentDetailMatch = location.pathname.match(/\/students\/([^/]+)/);
  const metaKey = studentDetailMatch ? studentDetailMatch[1] : segment;
  const meta = routeMeta[metaKey] || routeMeta.overview || { title: "Dashboard", subtitle: "" };
  const planName = planDetails?.name || user?.planName || "Basic";
  const firstName = (user?.firstName || user?.name || "Account").trim().split(/\s+/)[0] || "Account";

  function closeProfileMenu({ restoreFocus = true } = {}) {
    setProfileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
    }
  }

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handleDocumentClick(event) {
      if (!profileRef.current?.contains(event.target)) closeProfileMenu();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeProfileMenu();
      }
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
            ref={profileTriggerRef}
            type="button"
            className="dash-topbar__user"
            onClick={() => setProfileOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={user?.name} avatarUrl={user?.avatarUrl} />
            <span className="dash-topbar__user-text">
              <span className="dash-topbar__name">{firstName}</span>
            </span>
            <span className="dash-topbar__profile" aria-hidden="true">
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
          <div className={cn("dash-dropdown", profileOpen && "dash-dropdown--open")} role="menu" aria-hidden={!profileOpen}>
            <div className="dash-dropdown__summary">
              <strong>{user?.name || "Account"}</strong>
              <span>{user?.email || "Signed in"}</span>
              <span>{planName} plan</span>
            </div>
            <div className="dash-dropdown__divider" role="separator" />
            <NavLink to={`${basePath}/overview`} className="dash-dropdown__item" role="menuitem" onClick={() => closeProfileMenu({ restoreFocus: false })}>
              <LayoutDashboard className="dash-dropdown__icon" aria-hidden="true" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to={`${basePath}/settings`} className="dash-dropdown__item" role="menuitem" onClick={() => closeProfileMenu({ restoreFocus: false })}>
              <Settings className="dash-dropdown__icon" aria-hidden="true" />
              <span>Settings</span>
            </NavLink>
            <NavLink to={`${basePath}/billing`} className="dash-dropdown__item" role="menuitem" onClick={() => closeProfileMenu({ restoreFocus: false })}>
              <CreditCard className="dash-dropdown__icon" aria-hidden="true" />
              <span>Plans and Billing</span>
            </NavLink>
            <NavLink to={`${basePath}/help`} className="dash-dropdown__item" role="menuitem" onClick={() => closeProfileMenu({ restoreFocus: false })}>
              <CircleHelp className="dash-dropdown__icon" aria-hidden="true" />
              <span>Help and Support</span>
            </NavLink>
            <div className="dash-dropdown__divider" role="separator" />
            <button
              type="button"
              className="dash-dropdown__item dash-dropdown__item--danger"
              role="menuitem"
              onClick={() => {
                closeProfileMenu({ restoreFocus: false });
                signOut();
              }}
            >
              <LogOut className="dash-dropdown__icon" aria-hidden="true" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
