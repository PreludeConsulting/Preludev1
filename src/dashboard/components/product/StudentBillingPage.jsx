import { CreditCard, FileText, HelpCircle, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { openBillingPortal } from "../../../lib/auth.js";
import { estimateNextBillDate } from "../../../lib/billingDates.js";
import { getPlan, getPricingPlans } from "../../../lib/plans.js";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import {
  DashboardPageHeader,
  EmptyState,
  SecondaryButton,
  SectionCard
} from "../ui/index.jsx";
import { PlanWalletExperience } from "../../../components/PlanSelectionPage.jsx";
import BillingCurrentPlanCard from "./billing/BillingCurrentPlanCard.jsx";
import BillingInvoicesTable from "./billing/BillingInvoicesTable.jsx";
import BillingSummaryCard from "./billing/BillingSummaryCard.jsx";
import { buildRecentInvoices } from "./billing/billingDisplayData.js";

const SUPPORT_EMAIL = "support@preludeconsultingllc.com";

function BillingSectionTitle({ icon: Icon, children }) {
  return (
    <span className="billing-section-title">
      {Icon ? <Icon className="billing-section-title__icon" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export default function StudentBillingPage() {
  const { user, planDetails } = useAuth();
  const current = planDetails || (user?.plan ? getPlan(user.plan) : null);
  const currentPlanId = current?.id || user?.plan || null;
  const comparePlans = useMemo(
    () => getPricingPlans().filter((plan) => plan.id !== currentPlanId),
    [currentPlanId]
  );

  const [billingMessage, setBillingMessage] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);

  const nextBillDate = estimateNextBillDate(user);
  const invoices = useMemo(
    () =>
      buildRecentInvoices({
        planName: current?.name || "Pro",
        amount: current?.price || "$249.99",
        anchorDate: nextBillDate
      }),
    [current?.name, current?.price, nextBillDate]
  );

  async function handleManageBilling() {
    setBillingLoading(true);
    setBillingMessage("");
    try {
      const result = await openBillingPortal();
      if (result.url) window.location.href = result.url;
    } catch (error) {
      setBillingMessage(error.payload?.message || error.message || "Billing portal is not available yet.");
    } finally {
      setBillingLoading(false);
    }
  }

  return (
    <div className="dash-page dash-page--premium dash-billing-page">
      <DashboardPageHeader
        title="Plans and Billing"
        subtitle="Manage your membership, payments, and plan details."
        actions={
          <SecondaryButton
            as={Link}
            to={`${STUDENT_DASHBOARD_BASE}/help`}
            className="billing-page__support-btn"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Need help? Contact support
          </SecondaryButton>
        }
      />

      <div className="billing-page__layout">
        <div className="billing-page__col billing-page__col--left">
          <SectionCard
            title={<BillingSectionTitle icon={CreditCard}>Current Plan</BillingSectionTitle>}
            className="dash-panel billing-page__card"
          >
            {current ? (
              <BillingCurrentPlanCard plan={current} />
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No plan selected"
                description="Choose a plan to unlock your full Prelude dashboard experience."
              />
            )}
          </SectionCard>

          <SectionCard
            title={<BillingSectionTitle icon={FileText}>Billing Summary</BillingSectionTitle>}
            className="dash-panel billing-page__card billing-page__card--summary"
          >
            <BillingSummaryCard
              nextBillDate={nextBillDate}
              loading={billingLoading}
              message={billingMessage}
              onManage={handleManageBilling}
            />
          </SectionCard>
        </div>

        <div className="billing-page__col billing-page__col--right">
          <SectionCard
            title={<BillingSectionTitle icon={Scale}>Compare Plans</BillingSectionTitle>}
            className="dash-panel billing-page__card billing-page__card--compare"
          >
            <div className="billing-page__wallet">
              {comparePlans.length > 0 ? (
                <PlanWalletExperience
                  context="billing"
                  user={user}
                  plans={comparePlans}
                  persistState={false}
                  experienceClassName="billing-page__wallet-experience"
                />
              ) : (
                <p className="dash-muted">You are on every available Prelude plan tier.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={<BillingSectionTitle icon={FileText}>Recent Billing</BillingSectionTitle>}
            className="dash-panel billing-page__card billing-page__card--invoices"
            action={
              <button type="button" className="billing-page__view-all" onClick={handleManageBilling}>
                View all invoices
              </button>
            }
          >
            <BillingInvoicesTable invoices={invoices} />
          </SectionCard>
        </div>
      </div>

      <p className="billing-page__support-fallback dash-muted">
        Prefer email?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="billing-page__support-link">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}
