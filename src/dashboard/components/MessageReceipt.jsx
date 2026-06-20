import { AlertCircle, Check, CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils.js";

/** @param {'sending' | 'sent' | 'delivered' | 'read' | 'failed'} status */
export default function MessageReceipt({ status, className, onRetry }) {
  if (!status || status === "sending") {
    return <span className={cn("dash-receipt dash-receipt--sending", className)}>Sending…</span>;
  }
  if (status === "sent") {
    return (
      <span className={cn("dash-receipt", className)} aria-label="Sent">
        <Check className="h-3 w-3" />
        Sent
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span className={cn("dash-receipt", className)} aria-label="Delivered">
        <CheckCheck className="h-3 w-3" />
        Delivered
      </span>
    );
  }
  if (status === "read") {
    return (
      <span className={cn("dash-receipt dash-receipt--read", className)} aria-label="Read">
        <CheckCheck className="h-3 w-3" />
        Read
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn("dash-receipt dash-receipt--failed", className)} role="alert">
        <AlertCircle className="h-3 w-3" aria-hidden="true" />
        Not sent
        {onRetry ? (
          <button type="button" className="dash-receipt__retry" onClick={onRetry}>Retry</button>
        ) : null}
      </span>
    );
  }
  return null;
}
