import {
  ChevronDown,
  CreditCard,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import {
  billingPathForRole,
  dashboardPathForRole,
  helpPathForRole,
  settingsPathForRole
} from "../lib/onboardingRoutes.js";
import PlanBadge from "./PlanBadge.jsx";
import UserAvatar from "./UserAvatar.jsx";
import DropdownMenu, {
  DropdownMenuDivider,
  DropdownMenuHeader,
  DropdownMenuItem
} from "./ui/DropdownMenu.jsx";

export default function UserMenuDropdown({ className = "" }) {
  const { user, signOut, planDetails } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const firstName = user.name?.split(/\s+/)[0] || "Account";
  const dashboardPath = dashboardPathForRole(user.role);
  const settingsPath = settingsPathForRole(user.role);
  const billingPath = billingPathForRole(user.role);
  const helpPath = helpPathForRole(user.role);
  const planLabel = planDetails ? `${planDetails.name} plan` : user.planName ? `${user.planName} plan` : "No plan selected";

  async function handleLogout(close) {
    close();
    await signOut();
    navigate("/", { replace: true });
  }

  return (
    <DropdownMenu
      className={`user-menu ${className}`}
      panelClassName="user-menu__panel dropdown-menu__panel--account"
      trigger={({ open, setOpen }) => (
        <button
          type="button"
          className="user-menu__trigger account-menu-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" className="account-menu-btn__avatar" />
          <span className="account-menu-btn__name">{firstName}</span>
          {user.plan ? <PlanBadge planId={user.plan} /> : null}
          <ChevronDown className={`account-menu-btn__chevron h-4 w-4 ${open ? "user-menu__chevron--open" : ""}`} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <DropdownMenuHeader name={user.name} email={user.email} meta={planLabel} />
          <DropdownMenuItem as={Link} to={dashboardPath} onSelect={close}>
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem as={Link} to={settingsPath} onSelect={close}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem as={Link} to={billingPath} onSelect={close}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            Plans and Billing
          </DropdownMenuItem>
          <DropdownMenuItem as={Link} to={helpPath} onSelect={close}>
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Help and Support
          </DropdownMenuItem>
          <DropdownMenuDivider />
          <DropdownMenuItem danger onSelect={() => handleLogout(close)}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log Out
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenu>
  );
}
