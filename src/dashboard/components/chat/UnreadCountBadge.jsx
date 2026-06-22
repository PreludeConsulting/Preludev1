import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils.js";

const DISMISS_MS = 360;

export function useUnreadBadgeDismiss(count) {
  const [visible, setVisible] = useState(count > 0);
  const [dismissing, setDismissing] = useState(false);
  const displayCount = useRef(count > 0 ? count : 0);

  useEffect(() => {
    if (count > 0) {
      displayCount.current = count;
      setVisible(true);
      setDismissing(false);
      return;
    }
    if (!dismissing) {
      setVisible(false);
    }
  }, [count, dismissing]);

  const dismissBadge = useCallback(() => {
    if (!visible || count <= 0 || dismissing) return;
    displayCount.current = count;
    setDismissing(true);
  }, [visible, count, dismissing]);

  useEffect(() => {
    if (!dismissing) return undefined;
    const timer = window.setTimeout(() => {
      setVisible(false);
      setDismissing(false);
    }, DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dismissing]);

  return {
    showBadge: visible && (count > 0 || dismissing),
    badgeCount: displayCount.current,
    dismissing,
    dismissBadge
  };
}

export default function UnreadCountBadge({ count, dismissing = false, className, ...props }) {
  const label = count > 9 ? "9+" : String(count);

  return (
    <span
      className={cn(
        "dash-unread-badge",
        `dash-unread-badge--chars-${label.length}`,
        dismissing && "dash-unread-badge--dismissing",
        className
      )}
      {...props}
    >
      <span className="dash-unread-badge__label">{label}</span>
    </span>
  );
}
