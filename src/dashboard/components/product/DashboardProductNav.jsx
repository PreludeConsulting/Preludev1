import { Bell, ChevronDown, CreditCard, HelpCircle, LayoutDashboard, LogOut, Menu, Search, Settings, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import PreludeLogo from "../../../components/PreludeLogo.jsx";
import UserAvatar from "../../../components/UserAvatar.jsx";
import DropdownMenu, {
  DropdownMenuDivider,
  DropdownMenuHeader,
  DropdownMenuItem
} from "../../../components/ui/DropdownMenu.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  billingPathForRole,
  dashboardPathForRole,
  helpPathForRole,
  notificationsPathForRole,
  settingsPathForRole
} from "../../../lib/onboardingRoutes.js";
import { cn } from "../../../lib/utils.js";
import { MENTOR_NAV, STUDENT_NAV } from "../../config/navConfig.js";

export default function DashboardProductNav({ navItems, basePath, secondaryNav }) {
  const { user, signOut } = useAuth();
  const { notifications } = useDashboardData();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const overflowNav = secondaryNav || (user?.role === "mentor" ? MENTOR_NAV : STUDENT_NAV);
  const notificationsPath = notificationsPathForRole(user?.role);
  const dashboardPath = dashboardPathForRole(user?.role);
  const settingsPath = settingsPathForRole(user?.role);
  const billingPath = billingPathForRole(user?.role);
  const helpPath = helpPathForRole(user?.role);
  const unreadCount = notifications.filter((n) => n.unread).length;

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

  const firstName = user?.name?.split(/\s+/)[0] || "Account";

  async function handleSignOut(close) {
    close?.();
    await signOut();
    navigate("/", { replace: true });
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
          <label className="dash-product-nav__search hidden xl:flex">
            <Search className="h-4 w-4" aria-hidden="true" />
            <input type="search" placeholder="Search Prelude…" aria-label="Search dashboard" />
          </label>
          <Link
            to={notificationsPath}
            className="dash-product-nav__icon-btn"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? <span className="dash-product-nav__badge">{unreadCount}</span> : null}
          </Link>
          <DropdownMenu
            className="dash-product-nav__profile"
            panelClassName="dash-dropdown dropdown-menu__panel"
            trigger={({ open, setOpen }) => (
              <button
                type="button"
                className="dash-product-nav__profile-trigger"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Account menu"
                onClick={() => setOpen(!open)}
              >
                <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size="sm" className="dash-avatar dash-avatar--md" />
                <span className="dash-product-nav__profile-text hidden lg:block">
                  <span className="dash-product-nav__name">{firstName}</span>
                  <span className="dash-product-nav__role">{roleLabel}</span>
                </span>
                <ChevronDown className={`dash-product-nav__profile-chevron h-4 w-4 ${open ? "user-menu__chevron--open" : ""}`} aria-hidden="true" />
              </button>
            )}
          >
            {({ close }) => (
              <>
                <DropdownMenuHeader
                  name={user?.name}
                  email={user?.email}
                  meta={user?.planName ? `${user.planName} plan` : undefined}
                />
                <DropdownMenuItem as={Link} to={dashboardPath} onSelect={close}>
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem as={Link} to={settingsPath} onSelect={close}>
                  <Settings className="h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem as={Link} to={billingPath} onSelect={close}>
                  <CreditCard className="h-4 w-4" /> Plans and Billing
                </DropdownMenuItem>
                <DropdownMenuItem as={Link} to={helpPath} onSelect={close}>
                  <HelpCircle className="h-4 w-4" /> Help and Support
                </DropdownMenuItem>
                <DropdownMenuDivider />
                <DropdownMenuItem danger onSelect={() => handleSignOut(close)}>
                  <LogOut className="h-4 w-4" /> Log Out
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenu>
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
              <hr className="dash-product-mobile__divider" />
              <Link to="/" className="dash-product-mobile__link" onClick={() => setMobileOpen(false)}>
                Back to homepage
              </Link>
              <button type="button" className="dash-product-mobile__link dash-product-mobile__link--danger" onClick={() => handleSignOut()}>
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
