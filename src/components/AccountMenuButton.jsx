import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import PlanBadge from "./PlanBadge.jsx";
import { normalizePlanId } from "../lib/plans.js";

function userInitial(name) {
  const part = (name || "P").trim().split(/\s+/)[0];
  return (part[0] || "P").toUpperCase();
}

export default function AccountMenuButton({ onClick, className = "" }) {
  const { user } = useAuth();
  if (!user) return null;
  const firstName = user.name?.split(/\s+/)[0] || "Account";
  const planId = normalizePlanId(user.plan);

  return (
    <button type="button" onClick={onClick} className={`account-menu-btn ${className}`} aria-haspopup="dialog">
      <span className="account-menu-btn__avatar" aria-hidden="true">
        {userInitial(user.name)}
      </span>
      <span className="account-menu-btn__name">{firstName}</span>
      {planId ? <PlanBadge planId={planId} className="account-menu-btn__plan" /> : null}
      <ChevronDown className="account-menu-btn__chevron h-4 w-4" aria-hidden="true" />
    </button>
  );
}
