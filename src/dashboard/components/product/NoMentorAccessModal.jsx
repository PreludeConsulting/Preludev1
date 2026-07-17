import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, CreditCard, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useBelowHeaderModalOffset } from "../../hooks/useBelowHeaderModalOffset.js";
import {
  buildPurchaseSessionsPath,
  buildSubscriptionPath
} from "../../../../shared/mentorAccess.js";

export default function NoMentorAccessModal({
  open,
  onClose,
  mentorId = null,
  mentorUserId = null,
  purchaseHref,
  subscriptionHref = buildSubscriptionPath()
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useBelowHeaderModalOffset(open);

  const sessionsHref =
    purchaseHref ||
    buildPurchaseSessionsPath({ mentorId, mentorUserId });

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="dash-no-access dash-overlay--below-header"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className="dash-no-access__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="dash-no-access__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>

        <div className="dash-no-access__copy">
          <h2 id={titleId} className="dash-no-access__title">
            No sessions available
          </h2>
          <p id={descId} className="dash-no-access__subtitle">
            Sorry, you do not have any sessions remaining with this mentor. Purchase more sessions
            or start a monthly subscription to continue.
          </p>
        </div>

        <div className="dash-no-access__actions">
          <Link
            to={sessionsHref}
            className="dash-btn dash-btn--primary dash-no-access__cta"
            onClick={onClose}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Purchase sessions
          </Link>
          <Link
            to={subscriptionHref}
            className="dash-btn dash-btn--secondary dash-no-access__cta"
            onClick={onClose}
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            View subscription
          </Link>
          <button type="button" className="dash-no-access__cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
