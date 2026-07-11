import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bindFocusTrap } from "../../lib/focusTrap.js";

/**
 * Viewport-aware anchored popover rendered in a portal.
 */
export default function PopoverPortal({
  open,
  anchorRef,
  onClose,
  children,
  className,
  role = "dialog",
  ariaLabel,
  trapFocus = true,
  align = "end"
}) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState({});

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current || !panelRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = anchor.bottom + margin;
    let left = align === "end" ? anchor.right - panel.width : anchor.left;

    if (left < margin) left = margin;
    if (left + panel.width > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - panel.width - margin);
    }
    if (top + panel.height > viewportHeight - margin) {
      const above = anchor.top - panel.height - margin;
      if (above >= margin) top = above;
    }

    setStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 720,
      maxWidth: `min(25.5rem, calc(100vw - ${margin * 2}px))`
    });
  }, [open, anchorRef, align, children]);

  useEffect(() => {
    if (!open || !trapFocus) return undefined;
    return bindFocusTrap(panelRef.current, {
      onEscape: onClose,
      returnFocusRef: anchorRef
    });
  }, [open, onClose, trapFocus, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      className={className}
      role={role}
      aria-modal={role === "dialog" ? "true" : undefined}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}
