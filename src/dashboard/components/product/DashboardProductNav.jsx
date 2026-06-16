import { Bell, ChevronDown, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import PreludeLogo from "../../../components/PreludeLogo.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { cn } from "../../../lib/utils.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { Avatar } from "../ui/index.jsx";

export default function DashboardProductNav({ navItems, basePath }) {
  const { user, signOut, openAccount } = useAuth();
  const { notifications, markNotificationsRead } = useDashboardData();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications]
  );

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }

    function onPointerDown(event) {
      const inProfile = profileRef.current?.contains(event.target);
      const inNotifications = notificationsRef.current?.contains(event.target);
      if (!inProfile && !inNotifications) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [profileOpen, notificationsOpen]);

  function isTabActive(item) {
    const path = `${basePath}${item.to}`;
    if (item.workspaceTab) {
      return location.pathname === `${basePath}/workspace` && location.state?.workspaceTab === item.workspaceTab;
    }
    if (item.end) {
      return location.pathname === path || location.pathname === `${path}/`;
    }
    return location.pathname.startsWith(path);
  }

  function toggleNotifications() {
    setNotificationsOpen((open) => {
      const next = !open;
      if (next) {
        setProfileOpen(false);
        if (unreadCount > 0) {
          window.setTimeout(() => markNotificationsRead(), 0);
        }
      }
      return next;
    });
  }

  function toggleProfile() {
    setProfileOpen((open) => {
      const next = !open;
      if (next) setNotificationsOpen(false);
      return next;
    });
  }

  return (
    <header className="dash-product-nav">
      <Link to="/" className="dash-product-nav__logo">
        <PreludeLogo className="prelude-logo--compact" />
      </Link>

      <nav className="dash-product-nav__tabs" aria-label="Dashboard sections">
        {navItems.map(({ to, label, icon: Icon, end, workspaceTab }) => (
          <NavLink
            key={`${to}-${workspaceTab || label}`}
            to={`${basePath}${to}`}
            end={end}
            state={workspaceTab ? { workspaceTab } : undefined}
            className={() =>
              cn("dash-product-nav__tab", isTabActive({ to, end, workspaceTab }) && "dash-product-nav__tab--active")
            }
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="dash-product-nav__right">
        <div className="dash-product-nav__notifications" ref={notificationsRef}>
          <button
            type="button"
            className="dash-product-nav__icon-btn"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={toggleNotifications}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="dash-product-nav__badge" aria-hidden="true">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
          {notificationsOpen ? (
            <div className="dash-product-nav__menu-panel dash-product-nav__notifications-panel" role="dialog" aria-label="Notifications">
              <div className="dash-product-nav__notifications-head">
                <strong>Notifications</strong>
                {unreadCount > 0 ? <span>{unreadCount} new</span> : null}
              </div>
              {notifications.length ? (
                <ul className="dash-product-nav__notifications-list">
                  {notifications.slice(0, 8).map((item) => (
                    <li
                      key={item.id}
                      className={item.unread ? "dash-product-nav__notification dash-product-nav__notification--unread" : "dash-product-nav__notification"}
                    >
                      <p className="dash-product-nav__notification-title">{item.title}</p>
                      {item.body ? <p className="dash-product-nav__notification-body">{item.body}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dash-product-nav__notifications-empty">No notifications yet.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="dash-product-nav__profile" ref={profileRef}>
          <button
            type="button"
            className="dash-product-nav__profile-btn"
            onClick={toggleProfile}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <Avatar name={user?.name} />
            <div className="dash-product-nav__profile-text hidden sm:block">
              <p className="dash-product-nav__name">{user?.name}</p>
              <p className="dash-product-nav__role">{roleLabel}</p>
            </div>
            <ChevronDown
              className={cn("dash-product-nav__profile-chevron", profileOpen && "dash-product-nav__profile-chevron--open")}
              aria-hidden="true"
            />
          </button>
          {profileOpen ? (
            <div className="dash-product-nav__menu-panel dash-product-nav__profile-menu" role="menu">
              <NavLink
                to={`${basePath}/settings`}
                className="dash-product-nav__menu-item"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                <span>Profile & settings</span>
              </NavLink>
              <button
                type="button"
                className="dash-product-nav__menu-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  openAccount();
                }}
              >
                <span>Account & plan</span>
              </button>
              <button
                type="button"
                className="dash-product-nav__menu-item"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  signOut();
                }}
              >
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
