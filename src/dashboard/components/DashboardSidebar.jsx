import { X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import PreludeLogo from "../../components/PreludeLogo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { cn } from "../../lib/utils.js";
import { Avatar } from "./ui/index.jsx";

export default function DashboardSidebar({
  navItems,
  basePath,
  mobileOpen,
  expanded,
  onSidebarEnter,
  onSidebarLeave,
  onMobileClose
}) {
  const { user } = useAuth();
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const showLabels = expanded || mobileOpen;

  return (
    <aside
      className={cn(
        "dash-sidebar",
        "dash-sidebar--rail",
        mobileOpen && "dash-sidebar--open",
        expanded && !mobileOpen && "dash-sidebar--expanded"
      )}
      onMouseEnter={onSidebarEnter}
      onMouseLeave={onSidebarLeave}
    >
      <div className="dash-sidebar__top">
        {showLabels ? (
          <Link to="/" className="dash-sidebar__logo" onClick={onMobileClose}>
            <PreludeLogo className="prelude-logo--compact" />
          </Link>
        ) : (
          <Link to="/" className="dash-sidebar__logo dash-sidebar__logo--icon" onClick={onMobileClose} aria-label="Prelude home">
            <span className="dash-sidebar__mark">P</span>
          </Link>
        )}
        <button type="button" className="dash-sidebar__close lg:hidden" onClick={onMobileClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="dash-sidebar__nav" aria-label="Dashboard">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={`${basePath}${to}`}
            end={end}
            title={!showLabels ? label : undefined}
            className={({ isActive }) => cn("dash-nav-link", isActive && "dash-nav-link--active")}
            onClick={onMobileClose}
          >
            {Icon ? <Icon className="dash-nav-link__icon" aria-hidden="true" /> : null}
            <span className={cn("dash-nav-link__label", !showLabels && "dash-nav-link__label--hidden")}>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dash-sidebar__profile" title={!showLabels ? user?.name : undefined}>
        <Avatar name={user?.name} />
        {showLabels ? (
          <div className="dash-sidebar__profile-text">
            <p className="dash-sidebar__profile-name">{user?.name}</p>
            <p className="dash-sidebar__profile-role">{roleLabel}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
