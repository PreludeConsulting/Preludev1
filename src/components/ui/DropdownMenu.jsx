import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils.js";

/**
 * Reusable dropdown menu — click-outside, Escape, focus-friendly items.
 */
export default function DropdownMenu({
  trigger,
  children,
  className = "",
  panelClassName = "",
  align = "right",
  open: controlledOpen,
  onOpenChange
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    // Use click (not pointerdown) so Link navigation completes before the menu unmounts.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick, true);
    };
  }, [open, setOpen]);

  return (
    <div className={cn("dropdown-menu", className)} ref={rootRef}>
      {typeof trigger === "function" ? trigger({ open, setOpen }) : trigger}
      {open ? (
        <div
          className={cn(
            "dropdown-menu__panel",
            align === "left" && "dropdown-menu__panel--left",
            panelClassName
          )}
          role="menu"
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  className,
  danger,
  as: Tag = "button",
  onSelect,
  to,
  href,
  ...props
}) {
  const navigate = useNavigate();
  const isLink = Tag === Link || to || href;

  function handleActivate(event) {
    props.onClick?.(event);
    onSelect?.(event);
    if (event.defaultPrevented) return;
    if (to && Tag !== Link) {
      event.preventDefault();
      navigate(to);
    }
  }

  return (
    <Tag
      {...props}
      to={to}
      href={href}
      type={!isLink ? "button" : undefined}
      role="menuitem"
      className={cn("dropdown-menu__item", danger && "dropdown-menu__item--danger", className)}
      onClick={handleActivate}
    >
      {children}
    </Tag>
  );
}

export function DropdownMenuDivider() {
  return <hr className="dropdown-menu__divider" role="separator" />;
}

export function DropdownMenuHeader({ name, email, meta }) {
  return (
    <div className="dropdown-menu__header">
      {name ? <p className="dropdown-menu__header-name">{name}</p> : null}
      {email ? <p className="dropdown-menu__header-email">{email}</p> : null}
      {meta ? <p className="dropdown-menu__header-meta">{meta}</p> : null}
    </div>
  );
}
