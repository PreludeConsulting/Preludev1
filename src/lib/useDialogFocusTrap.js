import { useEffect, useRef } from "react";
import { bindFocusTrap, lockBodyScroll } from "./focusTrap.js";

/**
 * Owns focus containment, Escape handling, scroll locking, and focus restoration
 * for dialogs rendered inside the application root.
 */
export function useDialogFocusTrap(open, onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;

    const releaseScroll = lockBodyScroll(true);
    const releaseTrap = bindFocusTrap(dialogRef.current, {
      onEscape: () => onCloseRef.current?.(),
      // These dialogs live inside #root, so making #root inert would also make
      // the active dialog inert. Portal-based dialogs can use the helper's
      // default page isolation directly.
      isolatePage: false
    });

    return () => {
      releaseTrap();
      releaseScroll();
    };
  }, [open]);

  return dialogRef;
}
