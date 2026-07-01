import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { roleFromUser } from "../lib/dashboardRoutes.js";
import PlanBadge from "./PlanBadge.jsx";
import { normalizePlanId } from "../lib/plans.js";
import UserAvatar from "./UserAvatar.jsx";

export default function AccountMenuButton({ onClick, className = "" }) {
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.name?.split(/\s+/)[0] || "Account";
  const isMentor = roleFromUser(user) === "mentor";
  const planId = isMentor ? null : normalizePlanId(user.plan);

  return (
    <button type="button" onClick={onClick} className={`account-menu-btn ${className}`} aria-haspopup="dialog">
      <UserAvatar name={user.name} user={user} size="sm" className="account-menu-btn__avatar" />
      <span className="account-menu-btn__name">{firstName}</span>
      {planId ? <PlanBadge planId={planId} className="account-menu-btn__plan" /> : null}
      <ChevronDown className="account-menu-btn__chevron h-4 w-4" aria-hidden="true" />
    </button>
  );
}
