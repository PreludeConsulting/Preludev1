import { Bell, ChevronDown, Menu, Search, Settings, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import PreludeLogo from "../../../components/PreludeLogo.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { cn } from "../../../lib/utils.js";
import { MENTOR_NAV, STUDENT_NAV } from "../../config/navConfig.js";
import { Avatar } from "../ui/index.jsx";

export default function DashboardProductNav({ navItems, basePath, secondaryNav }) {
  const { user, signOut, openAccount } = useAuth();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const overflowNav = secondaryNav || (user?.role === "mentor" ? MENTOR_NAV : STUDENT_NAV);

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
          <button type="button" className="dash-product-nav__icon-btn" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <div className="dash-product-nav__profile">
            <Avatar name={user?.name} />
            <div className="dash-product-nav__profile-text hidden sm:block">
              <p className="dash-product-nav__name">{user?.name}</p>
              <p className="dash-product-nav__role">{roleLabel}</p>
            </div>
            <button
              type="button"
              className="dash-product-nav__profile-toggle"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              aria-label="Account menu"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            {profileOpen ? (
              <div className="dash-dropdown dash-product-nav__dropdown">
                <NavLink to={`${basePath}/profile`} className="dash-dropdown__item" onClick={() => setProfileOpen(false)}>
                  <Settings className="h-4 w-4" /> Profile & settings
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
