import { usePlanAccess } from "../../hooks/usePlanAccess.js";

export default function PlanSessionBanner({ meetings = [] }) {
  const {
    plan,
    sessionAllowanceLabel,
    monthlyOneOnOneLimit,
    remainingOneOnOneSessions,
    sessionCreditBalanceLabel
  } = usePlanAccess();
  const remaining = remainingOneOnOneSessions(meetings);
  const balanceLabel = sessionCreditBalanceLabel?.(meetings);

  return (
    <div className="dash-plan-session-banner" role="status">
      <p className="dash-plan-session-banner__label">{sessionAllowanceLabel}</p>
      {monthlyOneOnOneLimit > 0 ? (
        <p className="dash-plan-session-banner__meta">
          {balanceLabel || `${remaining} of ${monthlyOneOnOneLimit} session credits remaining`}
        </p>
      ) : (
        <p className="dash-plan-session-banner__meta">Your plan includes group mentorship access on the calendar.</p>
      )}
      <span className="dash-plan-session-banner__pill">{plan === "pro" ? "Pro" : plan === "plus" ? "Plus" : "Basic"} plan</span>
    </div>
  );
}
