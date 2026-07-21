import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Loader2, Package, RefreshCw, Sparkles } from "lucide-react";
import { useLanguage } from "../../../context/LanguageContext.jsx";
import { getPlanBadgeLabel } from "../../../lib/planBadges.js";
import {
  cancelMembership,
  fetchBillingHistory,
  fetchBillingSummary,
  reactivateMembership
} from "../../../lib/billingMembership.js";
import { openBillingPortal, startBillingCheckout } from "../../../lib/auth.js";
import { buildPurchaseSessionsPath } from "../../../../shared/mentorAccess.js";
import {
  formatBillingDate,
  formatBillingDateTime,
  formatMoneyCents
} from "../../../../shared/billingMembership.js";
import { Modal, PrimaryButton, SecondaryButton, SectionCard, EmptyState, DashBadge } from "../ui/index.jsx";

function statusBadgeVariant(key) {
  if (key === "active" || key === "trial") return "soft";
  if (key === "cancels_at_period_end") return "lavender";
  if (key === "past_due" || key === "incomplete") return "lavender";
  return "default";
}

export default function BillingMembershipPanel({
  compact = false,
  settingsBasePath = "/dashboard/student/settings"
}) {
  const { preferredLanguage } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ hasMore: false, offset: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResult, historyResult] = await Promise.all([
        fetchBillingSummary(),
        fetchBillingHistory({ limit: 10, offset: 0 })
      ]);
      setSummary(summaryResult);
      setHistory(historyResult.purchases || []);
      setHistoryMeta({
        hasMore: Boolean(historyResult.hasMore),
        offset: historyResult.offset || 0,
        total: historyResult.total || 0
      });
    } catch (err) {
      setError(err.message || "Could not load billing information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMoreHistory() {
    setHistoryLoading(true);
    try {
      const nextOffset = (historyMeta.offset || 0) + 10;
      const result = await fetchBillingHistory({ limit: 10, offset: nextOffset });
      setHistory((prev) => [...prev, ...(result.purchases || [])]);
      setHistoryMeta({
        hasMore: Boolean(result.hasMore),
        offset: nextOffset,
        total: result.total || 0
      });
    } catch (err) {
      setActionMessage(err.message || "Could not load more purchases.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function runAction(key, fn) {
    setActionLoading(key);
    setActionMessage("");
    try {
      const result = await fn();
      setActionMessage(result.message || "Updated.");
      setCancelOpen(false);
      await load();
    } catch (err) {
      setActionMessage(err.payload?.message || err.message || "That billing action failed.");
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
  const sessionsHref = buildPurchaseSessionsPath();
  const plansHref = "/plans";

  return (
    <>
      <SectionCard title="Membership" className="dash-panel" id="billing-membership">
        <div className="dash-billing-membership">
          <div className="dash-billing-membership__head">
            <div>
              <p className="dash-billing-membership__plan">
                {summary.plan?.name || "Basic"} plan
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

          <dl className="dash-billing-membership__meta">
            <div>
              <dt>Automatic renewal</dt>
              <dd>{membership.autoRenew ? "On" : "Off"}</dd>
            </div>
            {membership.renewsAt && membership.key === "active" ? (
              <div>
                <dt>Next renewal</dt>
                <dd>{formatBillingDate(membership.renewsAt)}</dd>
              </div>
            ) : null}
            {membership.endsAt && (membership.key === "cancels_at_period_end" || membership.key === "expired") ? (
              <div>
                <dt>Membership access ends</dt>
                <dd>{formatBillingDateTime(membership.endsAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Available sessions</dt>
              <dd>{summary.sessions?.available ?? 0}</dd>
            </div>
          </dl>

          <p className="dash-muted">{membership.explanation}</p>

          {actionMessage ? (
            <p className="dash-save-state dash-save-state--ok" role="status">
              {actionMessage}
            </p>
          ) : null}

          <div className="dash-billing-membership__actions">
            {actions.cancel ? (
              <SecondaryButton
                type="button"
                className="dash-btn--sm"
                onClick={() => setCancelOpen(true)}
                disabled={Boolean(actionLoading)}
              >
                Cancel membership
              </SecondaryButton>
            ) : null}
            {actions.reactivate ? (
              <PrimaryButton
                type="button"
                className="dash-btn--sm"
                loading={actionLoading === "reactivate"}
                onClick={() => runAction("reactivate", reactivateMembership)}
              >
                Keep membership
              </PrimaryButton>
            ) : null}
            {actions.purchaseMembership ? (
              <PrimaryButton
                type="button"
                className="dash-btn--sm"
                loading={actionLoading === "checkout"}
                onClick={() =>
                  runAction("checkout", async () => {
                    const planId = summary.plan?.id === "basic" ? "plus" : summary.plan?.id || "plus";
                    const result = await startBillingCheckout(planId, { context: "public" });
                    if (result.url) window.location.href = result.url;
                    return { message: "Redirecting to checkout…" };
                  })
                }
              >
                Purchase monthly membership
              </PrimaryButton>
            ) : null}
            {actions.purchaseSessions ? (
              <SecondaryButton as={Link} to={sessionsHref} className="dash-btn--sm">
                <Package className="h-4 w-4" aria-hidden="true" />
                Purchase sessions
              </SecondaryButton>
            ) : null}
            {actions.managePaymentMethod ? (
              <SecondaryButton
                type="button"
                className="dash-btn--sm"
                loading={actionLoading === "portal"}
                onClick={() =>
                  runAction("portal", async () => {
                    const result = await openBillingPortal();
                    if (result.url) window.location.href = result.url;
                    return { message: "Opening billing portal…" };
                  })
                }
              >
                Update payment method
              </SecondaryButton>
            ) : null}
            <SecondaryButton as={Link} to={plansHref} className="dash-btn--sm">
              View plans
            </SecondaryButton>
            {!compact ? (
              <SecondaryButton type="button" className="dash-btn--sm" onClick={load}>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </SecondaryButton>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Purchase history" className="dash-panel" id="billing-history">
        {history.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No purchases yet"
            description="Purchase a monthly membership or individual sessions to start contacting mentors."
            action={
              <SecondaryButton as={Link} to={plansHref} className="dash-btn--sm">
                View plans
              </SecondaryButton>
            }
          />
        ) : (
          <ul className="dash-billing-history">
            {history.map((purchase) => (
              <li key={purchase.id} className="dash-billing-history__item">
                <div>
                  <p className="dash-billing-history__title">{purchase.displayName}</p>
                  <p className="dash-muted">
                    {formatBillingDate(purchase.purchasedAt)}
                    {purchase.sessionsPurchased
                      ? ` · ${purchase.sessionsPurchased} session${purchase.sessionsPurchased === 1 ? "" : "s"}`
                      : ""}
                    {purchase.periodStart && purchase.periodEnd
                      ? ` · ${formatBillingDate(purchase.periodStart)} – ${formatBillingDate(purchase.periodEnd)}`
                      : ""}
                  </p>
                </div>
                <div className="dash-billing-history__aside">
                  <span>{purchase.amountLabel || formatMoneyCents(purchase.amountCents, purchase.currency)}</span>
                  <DashBadge variant="soft">{purchase.paymentStatus}</DashBadge>
                  {purchase.receiptUrl || purchase.invoicePdfUrl ? (
                    <a
                      href={purchase.receiptUrl || purchase.invoicePdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                    >
                      Receipt
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {historyMeta.hasMore ? (
          <SecondaryButton
            type="button"
            className="dash-btn--sm"
            loading={historyLoading}
            onClick={loadMoreHistory}
          >
            Load more
          </SecondaryButton>
        ) : null}
        <p className="dash-muted dash-billing-membership__settings-hint">
          You can also manage billing from{" "}
          <Link to={`${settingsBasePath}#billing`}>Settings → Billing</Link>.
        </p>
      </SectionCard>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel membership?"
        belowHeader
        footer={
          <>
            <SecondaryButton type="button" onClick={() => setCancelOpen(false)} disabled={actionLoading === "cancel"}>
              Keep membership
            </SecondaryButton>
            <PrimaryButton
              type="button"
              loading={actionLoading === "cancel"}
              onClick={() => runAction("cancel", cancelMembership)}
            >
              Confirm cancellation
            </PrimaryButton>
          </>
        }
      >
        <p>
          Your membership will remain active until{" "}
          <strong>{formatBillingDateTime(membership.currentPeriodEnd || membership.endsAt) || "the end of the current billing period"}</strong>.
          You will not be charged again unless you renew or reactivate your membership.
        </p>
        <p className="dash-muted">
          Purchased session credits remain available according to their existing rules. Mentor-contact access from the monthly plan ends at that timestamp.
        </p>
      </Modal>
    </>
  );
}
