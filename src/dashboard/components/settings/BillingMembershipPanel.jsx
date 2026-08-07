import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { CreditCard, Loader2, Package, RefreshCw, Sparkles } from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { getPlanBadgeLabel } from "../../../lib/planBadges.js";
import { fetchBillingSummary, reactivateMembership } from "../../../lib/billingMembership.js";
import { buildEssaySupportPath } from "../../../../shared/mentorAccess.js";
import { STUDENT_BILLING_PLANS_PATH } from "../../../../shared/stripePaymentLinks.js";
import EssaySupportCreditsSummary from "../../../components/EssaySupportCreditsSummary.jsx";
import {
  formatBillingDate,
  formatBillingDateTime
} from "../../../../shared/billingMembership.js";
import { openBillingPortal } from "../../../lib/auth.js";
import { useSubscription } from "../../../context/SubscriptionContext.jsx";
import { PrimaryButton, SecondaryButton, SectionCard, EmptyState, DashBadge } from "../ui/index.jsx";

function statusBadgeVariant(key) {
  if (key === "active" || key === "trial") return "soft";
  if (key === "cancels_at_period_end") return "lavender";
  if (key === "past_due" || key === "incomplete") return "lavender";
  return "default";
}

export default function BillingMembershipPanel({
  compact = false,
  // Accepted by Settings / Feature page callers; hint UI was removed from this panel.
  settingsBasePath: _settingsBasePath
}) {
  const { preferredLanguage } = useLanguage();
  const location = useLocation();
  const { syncAfterStripe, syncing } = useSubscription();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const summaryResult = await fetchBillingSummary();
      setSummary(summaryResult);
    } catch (err) {
      setError(err.message || "We couldn’t refresh your billing information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success" || params.get("portal") === "return") {
      setActionMessage("Syncing your plan…");
      syncAfterStripe().then(() => load());
    }
  }, [load, syncAfterStripe]);

  useEffect(() => {
    if (location.state?.planChangeProcessing) {
      setActionMessage("Syncing your plan…");
      syncAfterStripe({
        expectActivePlanId: location.state?.targetPlan || null
      }).then(() => load());
    }
  }, [location.state, load, syncAfterStripe]);

  async function runAction(key, fn) {
    setActionLoading(key);
    setActionMessage("");
    try {
      const result = await fn();
      setActionMessage(result.message || "Updated.");
      await load();
    } catch (err) {
      setActionMessage(err.payload?.message || err.message || "That billing action failed.");
    } finally {
      setActionLoading("");
    }
  }

  async function handleManageBilling() {
    setActionMessage("");
    setActionLoading("portal");
    try {
      const result = await openBillingPortal();
      const url = result?.url;
      if (!url) {
        setActionMessage(result?.message || "No billing profile exists for this account yet.");
        return;
      }
      window.location.assign(url);
    } catch (err) {
      setActionMessage(
        err.payload?.message || err.message || "We couldn’t open your billing settings. Please try again."
      );
    } finally {
      setActionLoading("");
    }
  }

  if (loading) {
    return (
      <SectionCard title="Billing & membership" className="dash-panel">
        <p className="dash-muted" role="status">
          <Loader2 className="dash-referral-code__spinner" aria-hidden="true" /> Loading membership…
        </p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Billing & membership" className="dash-panel">
        <p className="dash-save-state dash-save-state--error" role="alert">
          {error}
        </p>
        <SecondaryButton type="button" className="dash-btn--sm" onClick={load}>
          Try again
        </SecondaryButton>
      </SectionCard>
    );
  }

  if (!summary?.eligible) {
    return (
      <SectionCard title="Billing & membership" className="dash-panel">
        <EmptyState
          icon={CreditCard}
          title="Billing not available"
          description="Membership billing is available for student and parent accounts."
        />
      </SectionCard>
    );
  }

  const membership = summary.membership || {};
  const planBadgeLabel = getPlanBadgeLabel(summary.plan?.id, preferredLanguage);
  const actions = membership.actions || {};
  const essaySupportHref = buildEssaySupportPath();
  const plansHref = STUDENT_BILLING_PLANS_PATH;
  const isEssaySupportOnly =
    summary.plan?.id === "basic" && !summary.entitlement?.isActive && !(membership.accessActive);
  const reviewCredits = summary.reviewCredits || null;
  const hasEssayCredits =
    Number(reviewCredits?.purchased || 0) > 0 || Number(reviewCredits?.remaining || 0) > 0;
  const sessionCredits = summary.sessions?.subscriptionCredits || null;
  const scheduledMembership = summary.entitlement?.scheduledMembership || summary.membership?.pendingPlanId || null;
  const scheduledAt =
    summary.entitlement?.scheduledMembershipEffectiveAt ||
    membership.entitlementEndsAt ||
    membership.endsAt ||
    null;
  const canManageBilling = Boolean(
    membership.hasCustomer ||
      summary.canOpenCustomerPortal ||
      membership.stripeSubscriptionId ||
      actions.managePaymentMethod
  );
  const hasActiveMembership = Boolean(
    summary.entitlement?.isActive ||
      membership.accessActive ||
      summary.entitlement?.effectiveMembership
  );

  return (
    <SectionCard title={isEssaySupportOnly ? "Essay Support" : "Membership"} className="dash-panel" id="billing-membership">
      <div className="dash-billing-membership">
        {isEssaySupportOnly ? (
          <EssaySupportCreditsSummary
            reviewCredits={summary.reviewCredits}
            packages={summary.sessions?.packages}
          />
        ) : (
          <>
            <div className="dash-billing-membership__head">
              <div>
                <p className="dash-billing-membership__plan">
                  {summary.plan?.name} plan
                  {planBadgeLabel ? (
                    <>
                      {" "}
                      <DashBadge variant="lavender" className="dash-billing-membership__plan-badge">
                        <Sparkles className="h-3 w-3 dash-billing-membership__plan-badge-icon" aria-hidden="true" />
                        {planBadgeLabel}
                      </DashBadge>
                    </>
                  ) : null}
                </p>
                <p className="dash-billing-membership__price">
                  {summary.plan?.priceLabel || "—"}
                  <span className="dash-muted"> / month</span>
                </p>
              </div>
              <DashBadge variant={statusBadgeVariant(membership.key)}>{membership.label}</DashBadge>
            </div>

            {(membership.renewsAt && membership.key === "active") ||
            (membership.endsAt &&
              (membership.key === "cancels_at_period_end" || membership.key === "expired")) ? (
              <dl className="dash-billing-membership__meta dash-billing-membership__meta--compact">
                {membership.renewsAt && membership.key === "active" ? (
                  <div>
                    <dt>Next renewal</dt>
                    <dd>{formatBillingDate(membership.renewsAt)}</dd>
                  </div>
                ) : null}
                {membership.endsAt &&
                (membership.key === "cancels_at_period_end" || membership.key === "expired") ? (
                  <div>
                    <dt>Membership access ends</dt>
                    <dd>{formatBillingDateTime(membership.endsAt)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {sessionCredits?.active ? (
              <p className="dash-muted">
                Session credits: {sessionCredits.remaining} of {sessionCredits.allowance} remaining
              </p>
            ) : null}

            <p className="dash-muted dash-billing-membership__explanation">{membership.explanation}</p>
            {hasEssayCredits ? (
              <div className="dash-billing-membership__essay-alongside">
                <EssaySupportCreditsSummary
                  reviewCredits={summary.reviewCredits}
                  packages={summary.sessions?.packages}
                />
              </div>
            ) : null}
            {scheduledMembership === "pro" ? (
              <p className="dash-muted" role="status">
                Upgrade to Pro is pending payment confirmation
                {scheduledAt ? ` (current period through ${formatBillingDate(scheduledAt)})` : ""}.
              </p>
            ) : null}
            {scheduledMembership === "plus" ? (
              <p className="dash-muted" role="status">
                Scheduled change: switches to Plus
                {scheduledAt ? ` on ${formatBillingDate(scheduledAt)}` : " at the end of the current billing period"}.
                You keep Pro access until then.
              </p>
            ) : null}
            {syncing ? (
              <p className="dash-muted" role="status">
                Syncing your subscription…
              </p>
            ) : null}
          </>
        )}

        {actionMessage && actionMessage !== "Syncing your plan…" ? (
          <p className="dash-save-state dash-save-state--ok" role="status">
            {actionMessage}
          </p>
        ) : null}

        <div className="dash-billing-membership__actions">
          {canManageBilling ? (
            <SecondaryButton
              type="button"
              className="dash-btn--sm"
              disabled={Boolean(actionLoading)}
              onClick={handleManageBilling}
            >
              Manage billing
            </SecondaryButton>
          ) : null}
          {!isEssaySupportOnly && actions.reactivate ? (
            <PrimaryButton
              type="button"
              className="dash-btn--sm"
              loading={actionLoading === "reactivate"}
              onClick={() => runAction("reactivate", reactivateMembership)}
            >
              Keep membership
            </PrimaryButton>
          ) : null}
          {actions.purchaseSessions ? (
            <SecondaryButton as={Link} to={essaySupportHref} className="dash-btn--sm">
              <Package className="h-4 w-4" aria-hidden="true" />
              Purchase Essay Support
            </SecondaryButton>
          ) : null}
          {!hasActiveMembership ? (
            <SecondaryButton as={Link} to={plansHref} className="dash-btn--sm">
              View plans
            </SecondaryButton>
          ) : null}
          {!compact ? (
            <SecondaryButton type="button" className="dash-btn--sm" onClick={load}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </SecondaryButton>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}
