import { Check, CheckCheck } from "lucide-react";
import { cn } from "../../lib/utils.js";

/** @param {'sending' | 'sent' | 'delivered' | 'read'} status */
export default function MessageReceipt({ status, className }) {
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
  return null;
}
