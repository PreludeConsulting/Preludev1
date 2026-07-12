import { usePlanAccess } from "../../hooks/usePlanAccess.js";

export default function PlanSessionBanner({ meetings = [], applicationReviews = [] }) {
  const {
    plan,
    sessionAllowanceLabel,
    monthlyOneOnOneLimit,
    remainingOneOnOneSessions,
    sessionCreditBalanceLabel,
    monthlyApplicationReviewLimit,
    remainingApplicationReviews,
    applicationReviewBalanceLabel,
    applicationReviewAllowanceLabel
  } = usePlanAccess();
  const remaining = remainingOneOnOneSessions(meetings);
  const balanceLabel = sessionCreditBalanceLabel?.(meetings);
  const reviewRemaining = remainingApplicationReviews?.(applicationReviews);
  const reviewBalanceLabel = applicationReviewBalanceLabel?.(applicationReviews);

  return (
    <div className="dash-plan-session-banner" role="status">
      {monthlyOneOnOneLimit > 0 ? (
        <>
          <p className="dash-plan-session-banner__label">{sessionAllowanceLabel}</p>
          <p className="dash-plan-session-banner__meta">
            {balanceLabel || `${remaining} of ${monthlyOneOnOneLimit} session credits remaining`}
          </p>
          {monthlyApplicationReviewLimit > 0 ? (
            <p className="dash-plan-session-banner__meta">
              {reviewBalanceLabel ||
                `${reviewRemaining} of ${monthlyApplicationReviewLimit} application reviews remaining`}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="dash-plan-session-banner__label">
            {applicationReviewAllowanceLabel || sessionAllowanceLabel}
          </p>
          <p className="dash-plan-session-banner__meta">
            {reviewBalanceLabel ||
              `${reviewRemaining} of ${monthlyApplicationReviewLimit} application reviews remaining`}
          </p>
          <p className="dash-plan-session-banner__meta">No live session credits</p>
        </>
      )}
      <span className="dash-plan-session-banner__pill">{plan === "pro" ? "Pro" : plan === "plus" ? "Plus" : "Basic"} plan</span>
    </div>
  );
}
