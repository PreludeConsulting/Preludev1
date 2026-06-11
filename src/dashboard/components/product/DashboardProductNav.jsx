import { Bell, ChevronDown, Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import PreludeLogo from "../../../components/PreludeLogo.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { cn } from "../../../lib/utils.js";
import { MENTOR_NAV, STUDENT_NAV } from "../../config/navConfig.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { Avatar } from "../ui/index.jsx";

export default function DashboardProductNav({ navItems, basePath, secondaryNav }) {
  const { user, signOut, openAccount } = useAuth();
  const { notifications, markNotificationsRead } = useDashboardData();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const overflowNav = secondaryNav || (user?.role === "mentor" ? MENTOR_NAV : STUDENT_NAV);
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
    <>
      <header className="dash-product-nav">
        <div className="dash-product-nav__left">
          <button
            type="button"
            className="dash-product-nav__menu lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="dash-product-nav__logo">
            <PreludeLogo className="prelude-logo--compact" />
          </Link>
        </div>

        <nav className="dash-product-nav__tabs hidden lg:flex" aria-label="Dashboard sections">
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
          <label className="dash-product-nav__search hidden md:flex">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input type="search" placeholder="Search Prelude…" aria-label="Search dashboard" />
          </label>
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
                  to={`${basePath}/profile`}
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

      {mobileOpen ? (
        <div className="dash-product-mobile" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button type="button" className="dash-product-mobile__backdrop" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="dash-product-mobile__panel">
            <div className="dash-product-mobile__head">
              <PreludeLogo className="prelude-logo--compact" />
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="dash-product-mobile__nav">
              {navItems.map(({ to, label, icon: Icon, end, workspaceTab }) => (
                <NavLink
                  key={`mobile-${to}-${workspaceTab || label}`}
                  to={`${basePath}${to}`}
                  end={end}
                  state={workspaceTab ? { workspaceTab } : undefined}
                  className={({ isActive }) => cn("dash-product-mobile__link", isActive && "dash-product-mobile__link--active")}
                  onClick={() => setMobileOpen(false)}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  {label}
                </NavLink>
              ))}
              <hr className="dash-product-mobile__divider" />
              {overflowNav
                .filter((item) => !navItems.some((n) => n.to === item.to && !n.workspaceTab))
                .map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={`overflow-${to}`}
                    to={`${basePath}${to}`}
                    end={end}
                    className={({ isActive }) => cn("dash-product-mobile__link", isActive && "dash-product-mobile__link--active")}
                    onClick={() => setMobileOpen(false)}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    {label}
                  </NavLink>
                ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
