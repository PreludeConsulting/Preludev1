import { CreditCard, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import {
  DashboardPageHeader,
  SecondaryButton
} from "../ui/index.jsx";
import BillingMembershipPanel from "../settings/BillingMembershipPanel.jsx";

const SUPPORT_EMAIL = "support@preludeconsultingllc.com";

export default function StudentBillingPage() {
  return (
    <div className="dash-page dash-page--premium dash-billing-page">
      <DashboardPageHeader
        title="Plans and Billing"
        subtitle="Manage your membership, session balance, and purchase history."
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

      <BillingMembershipPanel settingsBasePath={`${STUDENT_DASHBOARD_BASE}/settings`} />

      <p className="billing-page__support-fallback dash-muted">
        Prefer email?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="billing-page__support-link">
          {SUPPORT_EMAIL}
        </a>
        {" · "}
        <Link to={`${STUDENT_DASHBOARD_BASE}/settings#billing`} className="billing-page__support-link">
          <CreditCard className="h-3.5 w-3.5 inline" aria-hidden="true" /> Settings → Billing
        </Link>
      </p>
    </div>
  );
}
