import { useCallback, useEffect, useRef, useState } from "react";

const COLLAPSE_DELAY_MS = 300;
const EDGE_ZONE_PX = 14;

export function useHoverSidebar() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const open = useCallback(() => {
    clearTimer();
    setExpanded(true);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setExpanded(false), COLLAPSE_DELAY_MS);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onEdgeEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      open();
    }
  }, [open]);

  const onSidebarEnter = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      open();
    }
  }, [open]);

  const onSidebarLeave = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      scheduleClose();
    }
  }, [scheduleClose]);

  const onEdgeMove = useCallback(
    (e) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      if (e.clientX <= EDGE_ZONE_PX) open();
    },
    [open]
  );

  useEffect(() => {
    window.addEventListener("mousemove", onEdgeMove);
    return () => window.removeEventListener("mousemove", onEdgeMove);
  }, [onEdgeMove]);

  return {
    expanded,
    mobileOpen,
    setMobileOpen,
    onSidebarEnter,
    onSidebarLeave,
    onEdgeEnter,
    open,
    scheduleClose
  };
}
