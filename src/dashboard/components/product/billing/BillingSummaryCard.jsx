import { Calendar, CreditCard, Lock, RefreshCw, Settings } from "lucide-react";
import { SecondaryButton } from "../../ui/index.jsx";
import { formatShortBillDate } from "./billingDisplayData.js";

export default function BillingSummaryCard({
  nextBillDate,
  paymentMethod = "•••• 4242",
  autoRenew = true,
  loading,
  message,
  onManage
}) {
  return (
    <div className="billing-summary">
      <ul className="billing-summary__list">
        <li>
          <Calendar className="billing-summary__icon" aria-hidden="true" />
          <div>
            <span className="billing-summary__label">Next payment</span>
            <span className="billing-summary__value">{formatShortBillDate(nextBillDate)}</span>
          </div>
        </li>
        <li>
          <CreditCard className="billing-summary__icon" aria-hidden="true" />
          <div>
            <span className="billing-summary__label">Payment method</span>
            <span className="billing-summary__value billing-summary__value--card">
              <span className="billing-summary__visa" aria-hidden="true">VISA</span>
              {paymentMethod}
            </span>
          </div>
        </li>
        <li>
          <RefreshCw className="billing-summary__icon" aria-hidden="true" />
          <div>
            <span className="billing-summary__label">Auto-renew</span>
            <span className={`billing-summary__pill ${autoRenew ? "billing-summary__pill--on" : ""}`}>
              {autoRenew ? "On" : "Off"}
            </span>
          </div>
        </li>
      </ul>

      {message ? (
        <p className="billing-summary__notice" role="status">
          {message}
        </p>
      ) : null}

      <SecondaryButton
        type="button"
        className="billing-summary__manage dash-btn--sm"
        onClick={onManage}
        disabled={loading}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        {loading ? "Opening…" : "Manage subscription"}
      </SecondaryButton>

      <p className="billing-summary__secure">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Your payment information is secure and encrypted.
      </p>
    </div>
  );
}
