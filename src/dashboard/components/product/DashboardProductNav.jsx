import { Bell, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, Lock, LogOut, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import PreludeLogo from "../../../components/PreludeLogo.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { cn } from "../../../lib/utils.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { usePreludeChatContextOptional } from "../../context/PreludeChatContext.jsx";
import UnreadCountBadge, { useUnreadBadgeDismiss } from "../chat/UnreadCountBadge.jsx";
import { Avatar } from "../ui/index.jsx";
import { usePlanAccess } from "../../hooks/usePlanAccess.js";
import { usePlanUpgrade } from "../../context/PlanUpgradeContext.jsx";

export default function DashboardProductNav({ navItems, basePath }) {
  const { user, signOut, planDetails } = useAuth();
  const { notifications, markNotificationsRead, profile } = useDashboardData();
  const chat = usePreludeChatContextOptional();
  const { canAccess } = usePlanAccess();
  const { openUpgrade } = usePlanUpgrade();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const tabsRef = useRef(null);
  const planName = planDetails?.name || user?.planName || "Basic";
  const firstName = (user?.firstName || user?.name || "Account").trim().split(/\s+/)[0] || "Account";
  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications]
  );
  const messageUnreadCount = chat?.unreadTotal ?? 0;
  const {
    showBadge: showMessageBadge,
    badgeCount: messageBadgeCount,
    dismissing: messageBadgeDismissing,
    dismissBadge: dismissMessageBadge
  } = useUnreadBadgeDismiss(messageUnreadCount);

  useEffect(() => {
    if (!profileOpen && !notificationsOpen) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        const wasProfileOpen = profileOpen;
        setProfileOpen(false);
        setNotificationsOpen(false);
        if (wasProfileOpen) {
          event.preventDefault();
          window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
        }
      }
    }

    function onPointerDown(event) {
      const inProfile = profileRef.current?.contains(event.target);
      const inNotifications = notificationsRef.current?.contains(event.target);
      if (!inProfile && !inNotifications) {
        const wasProfileOpen = profileOpen;
        setProfileOpen(false);
        setNotificationsOpen(false);
        if (wasProfileOpen) {
          window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [profileOpen, notificationsOpen]);

  function closeProfileMenu({ restoreFocus = true } = {}) {
    setProfileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
    }
  }

  useEffect(() => {
    const activeTab = tabsRef.current?.querySelector(".dash-product-nav__tab--active");
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [location.pathname, location.state]);

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

  function renderTabContent({ Icon, label, locked, hintLocked, messageBadge }) {
    return (
      <>
        {Icon ? <Icon className="dash-product-nav__tab-icon" aria-hidden="true" /> : null}
        <span className="dash-product-nav__tab-label">{label}</span>
        {locked || hintLocked ? (
          <Lock
            className={cn("dash-product-nav__lock-icon", hintLocked && !locked && "dash-product-nav__lock-icon--hint")}
            aria-hidden="true"
          />
        ) : null}
        {messageBadge}
      </>
    );
  }

  return (
    <header className="dash-product-nav">
      <Link to="/" className="dash-product-nav__logo">
        <PreludeLogo className="prelude-logo--compact" />
      </Link>

      <div className="dash-product-nav__nav-wrap">
        <nav className="dash-product-nav__tabs" aria-label="Dashboard sections" ref={tabsRef}>
        {navItems.map(({ to, label, icon: Icon, end, workspaceTab, lockFeature, hintLockFeature }) => {
          const locked = lockFeature && !canAccess(lockFeature);
          const hintLocked = hintLockFeature && !canAccess(hintLockFeature);
          const messageBadge =
            to === "/messages" && showMessageBadge ? (
              <UnreadCountBadge
                count={messageBadgeCount}
                dismissing={messageBadgeDismissing}
                className="dash-unread-badge--nav-tab"
                aria-label={`${messageBadgeCount} unread messages`}
              />
            ) : null;

          if (locked) {
            return (
              <button
                key={`${to}-${workspaceTab || label}`}
                type="button"
                className="dash-product-nav__tab dash-product-nav__tab--locked"
                aria-label={`${label} — upgrade to unlock`}
                onClick={() => openUpgrade(lockFeature)}
              >
                {renderTabContent({ Icon, label, locked: true, hintLocked: false, messageBadge: null })}
              </button>
            );
          }

          return (
            <NavLink
              key={`${to}-${workspaceTab || label}`}
              to={`${basePath}${to}`}
              end={end}
              state={workspaceTab ? { workspaceTab } : undefined}
              onClick={() => {
                if (to === "/messages" && messageUnreadCount > 0) {
                  dismissMessageBadge();
                }
              }}
              className={() =>
                cn("dash-product-nav__tab", isTabActive({ to, end, workspaceTab }) && "dash-product-nav__tab--active")
              }
            >
              {renderTabContent({ Icon, label, locked: false, hintLocked, messageBadge })}
            </NavLink>
          );
        })}
        </nav>
      </div>

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
            ref={profileTriggerRef}
            type="button"
            className="dash-product-nav__profile-btn"
            onClick={toggleProfile}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
          >
            <Avatar name={user?.name} user={user} profile={profile} />
            <div className="dash-product-nav__profile-text">
              <p className="dash-product-nav__name">{firstName}</p>
            </div>
            <ChevronDown
              className={cn("dash-product-nav__profile-chevron", profileOpen && "dash-product-nav__profile-chevron--open")}
              aria-hidden="true"
            />
          </button>
          <div
            className={cn("dash-product-nav__menu-panel dash-product-nav__profile-menu", profileOpen && "dash-product-nav__profile-menu--open")}
            role="menu"
            aria-hidden={!profileOpen}
          >
            <div className="dash-product-nav__account-summary">
              <strong>{user?.name || "Account"}</strong>
              <span>{user?.email || "Signed in"}</span>
              <span>{planName} plan</span>
            </div>
            <div className="dash-product-nav__menu-divider" role="separator" />
            <NavLink
              to={`${basePath}/overview`}
              className="dash-product-nav__menu-item"
              role="menuitem"
              onClick={() => closeProfileMenu({ restoreFocus: false })}
            >
              <LayoutDashboard className="dash-product-nav__menu-icon" aria-hidden="true" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to={`${basePath}/settings`}
              className="dash-product-nav__menu-item"
              role="menuitem"
              onClick={() => closeProfileMenu({ restoreFocus: false })}
            >
              <Settings className="dash-product-nav__menu-icon" aria-hidden="true" />
              <span>Settings</span>
            </NavLink>
            <NavLink
              to={`${basePath}/billing`}
              className="dash-product-nav__menu-item"
              role="menuitem"
              onClick={() => closeProfileMenu({ restoreFocus: false })}
            >
              <CreditCard className="dash-product-nav__menu-icon" aria-hidden="true" />
              <span>Plans and Billing</span>
            </NavLink>
            <NavLink
              to={`${basePath}/help`}
              className="dash-product-nav__menu-item"
              role="menuitem"
              onClick={() => closeProfileMenu({ restoreFocus: false })}
            >
              <CircleHelp className="dash-product-nav__menu-icon" aria-hidden="true" />
              <span>Help and Support</span>
            </NavLink>
            <div className="dash-product-nav__menu-divider" role="separator" />
            <button
              type="button"
              className="dash-product-nav__menu-item dash-product-nav__menu-item--danger"
              role="menuitem"
              onClick={() => {
                closeProfileMenu({ restoreFocus: false });
                signOut();
              }}
            >
              <LogOut className="dash-product-nav__menu-icon" aria-hidden="true" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
