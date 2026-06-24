import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { MotionDialog } from "../../../components/motion/MotionPrimitives.jsx";
import InteractiveButton from "../../../components/interaction/InteractiveButton.jsx";
import { Link } from "react-router-dom";
import { cn } from "../../../lib/utils.js";

export function DashBadge({ children, variant = "default", className }) {
  return <span className={cn("dash-badge", `dash-badge--${variant}`, className)}>{children}</span>;
}

export function PrimaryButton({ children, className, as: Tag = "button", loading, ...props }) {
  return (
    <InteractiveButton as={Tag} className={cn("dash-btn dash-btn--primary", className)} loading={loading} pressVariant="primary" {...props}>
      {children}
    </InteractiveButton>
  );
}

export function SecondaryButton({ children, className, as: Tag = "button", loading, ...props }) {
  return (
    <InteractiveButton as={Tag} className={cn("dash-btn dash-btn--secondary", className)} loading={loading} {...props}>
      {children}
    </InteractiveButton>
  );
}

export function IconButton({ children, className, label, loading, ...props }) {
  return (
    <InteractiveButton type="button" className={cn("dash-icon-btn", className)} aria-label={label} loading={loading} {...props}>
      {children}
    </InteractiveButton>
  );
}

export function DashboardHeading({ children, className }) {
  return <h1 className={cn("dash-page-title shopify-hero__headline", className)}>{children}</h1>;
}

export function DashboardPageHeader({ title, subtitle, actions }) {
  return (
    <header className="dash-page-header">
      <div>
        {title ? <DashboardHeading>{title}</DashboardHeading> : null}
        {subtitle ? <p className="dash-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="dash-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function StatCard({ icon: Icon, label, value, hint, badge }) {
  return (
    <article className="dash-stat-card">
      <div className="dash-stat-card__icon">{Icon ? <Icon className="h-5 w-5" /> : null}</div>
      <div className="dash-stat-card__body">
        <p className="dash-stat-card__label">{label}</p>
        <p className="dash-stat-card__value">{value}</p>
        {hint ? <p className="dash-stat-card__hint">{hint}</p> : null}
      </div>
      {badge ? <DashBadge variant="soft">{badge}</DashBadge> : null}
    </article>
  );
}

export function SectionCard({ title, action, children, className, padding = true, id }) {
  return (
    <section id={id} className={cn("dash-section-card", className)}>
      {title || action ? (
        <div className="dash-section-card__head">
          {title ? <h2 className="dash-section-card__title">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className={cn(padding && "dash-section-card__body")}>{children}</div>
    </section>
  );
}

export function ProgressBar({ label, value, max = 100, celebrate = false }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className={cn("dash-progress-row", celebrate && "dash-progress-row--celebrate")}>
      <div className="dash-progress-row__meta">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="dash-progress-row__track">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="dash-empty">
      {Icon ? <Icon className="dash-empty__icon" aria-hidden="true" /> : null}
      <p className="dash-empty__title">{title}</p>
      {description ? <p className="dash-empty__desc">{description}</p> : null}
      {action}
    </div>
  );
}

export function DashTabs({ tabs, active, onChange }) {
  return (
    <div className="dash-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={cn("dash-tabs__item", active === tab.id && "dash-tabs__item--active")}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <input
      type="search"
      className="dash-search-input"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}

export function Modal({ open, onClose, title, children, footer, className, scrollable }) {
  const titleId = useId();
  const backdropRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const openedFromKeyboard = Boolean(previousFocus?.matches?.(":focus-visible"));
    returnFocusRef.current = previousFocus;
    const getDialog = () => backdropRef.current?.querySelector('[role="dialog"]');

    const getFocusable = () => Array.from(getDialog()?.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) || []).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");

    const frame = window.requestAnimationFrame(() => {
      const focusTarget = openedFromKeyboard ? getFocusable()[0] : getDialog();
      focusTarget?.focus({ preventScroll: true });
    });

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        getDialog()?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === getDialog())) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
      returnFocusRef.current = null;
    };
  }, [open]);

  if (!open) return null;
  const modalNode = (
    <div ref={backdropRef} className="dash-modal-backdrop" role="presentation" onClick={onClose}>
      <MotionDialog
        className={cn("dash-modal", scrollable && "dash-modal--scrollable", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-modal__head">
          <h2 id={titleId} className="dash-modal__title">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="dash-modal__body">{children}</div>
        {footer ? <div className="dash-modal__footer">{footer}</div> : null}
      </MotionDialog>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(modalNode, document.body) : modalNode;
}

export function DeadlineRow({ title, dueDate, category, priority, done }) {
  return (
    <div className="dash-deadline-row">
      <input type="checkbox" checked={done} readOnly aria-hidden="true" />
      <div className="dash-deadline-row__main">
        <p className="dash-deadline-row__title">{title}</p>
        <p className="dash-deadline-row__date">{dueDate}</p>
      </div>
      <div className="dash-deadline-row__badges">
        {category ? <DashBadge variant="lavender">{category}</DashBadge> : null}
        {priority ? <DashBadge variant={priority === "high" ? "urgent" : "soft"}>{priority}</DashBadge> : null}
      </div>
    </div>
  );
}

export function Avatar({ name, size = "md" }) {
  const initial = (name || "?")[0];
  return <span className={cn("dash-avatar", `dash-avatar--${size}`)}>{initial}</span>;
}

export function MeetingPreviewCard({ meeting, mentorName, studentName, role, onView }) {
  const start = new Date(meeting.startTime);
  const showZoom = meeting.meetingType === "zoom" && meeting.zoomJoinUrl;
  return (
    <article className="dash-meeting-preview">
      <div className="dash-meeting-preview__head">
        <Avatar name={mentorName || studentName} />
        <div>
          <p className="dash-meeting-preview__title">{meeting.title}</p>
          <p className="dash-meeting-preview__meta">
            {mentorName ? `with ${mentorName}` : studentName ? `with ${studentName}` : ""}
          </p>
        </div>
        {meeting.meetingType === "zoom" ? <DashBadge variant="zoom">Zoom Meeting</DashBadge> : null}
      </div>
      <p className="dash-meeting-preview__time">
        {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
        {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </p>
      <div className="dash-meeting-preview__actions">
        {showZoom ? (
          <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--primary dash-btn--sm">
            Join Zoom Meeting
          </a>
        ) : null}
        {onView ? (
          <SecondaryButton type="button" className="dash-btn--sm" onClick={onView}>
            View Details
          </SecondaryButton>
        ) : null}
      </div>
    </article>
  );
}

export function StudentCard({ student, basePath, onSchedule }) {
  return (
    <article className="dash-student-card">
      <div className="dash-student-card__head">
        <Avatar name={student.name} size="lg" />
        <div>
          <h3 className="dash-student-card__name">{student.name}</h3>
          <p className="dash-student-card__meta">
            {student.grade} · {student.major}
          </p>
        </div>
        <DashBadge variant="soft">{student.profileCompletion}% profile</DashBadge>
      </div>
      <ProgressBar label="Profile completion" value={student.profileCompletion} />
      <div className="dash-student-card__facts">
        <span>Next: {student.nextMeeting}</span>
        <span>{student.upcomingDeadlines} deadlines</span>
      </div>
      <p className="dash-student-card__priority">Focus: {student.priorities?.[0]}</p>
      <div className="dash-student-card__actions">
        <Link to={`${basePath}/students/${student.id}`} className="dash-btn dash-btn--secondary dash-btn--sm">
          View Profile
        </Link>
        <Link to={`${basePath}/messages`} className="dash-btn dash-btn--secondary dash-btn--sm">
          Message
        </Link>
        <PrimaryButton type="button" className="dash-btn--sm" onClick={() => onSchedule?.(student)}>
          Schedule Meeting
        </PrimaryButton>
      </div>
    </article>
  );
}

export function SuggestionRow({ icon: Icon, text }) {
  return (
    <div className="dash-suggestion-row">
      {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
      <p>{text}</p>
    </div>
  );
}

export function ViewAllLink({ to, children = "View all" }) {
  return (
    <Link to={to} className="dash-view-all">
      {children}
    </Link>
  );
}
