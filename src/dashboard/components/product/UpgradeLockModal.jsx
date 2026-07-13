import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Coins, Gift, Lock, Sparkles, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getFeatureLockCopy } from "../../../lib/planFeatures.js";
import { useBelowHeaderModalOffset } from "../../hooks/useBelowHeaderModalOffset.js";

const REWARDS_BENEFITS = [
  {
    id: "coins",
    title: "Earn coins",
    description: "Complete tasks and build your balance",
    icon: Coins,
    tone: "gold"
  },
  {
    id: "sessions",
    title: "Bonus mentor sessions",
    description: "Get extra 1:1 guidance from experts",
    icon: Users,
    tone: "purple"
  },
  {
    id: "rewards",
    title: "Exclusive rewards",
    description: "Redeem premium rewards and perks",
    icon: Gift,
    tone: "pink"
  }
];

function getModalContent(featureKey) {
  if (featureKey === "rewards" || featureKey === "advancedRewards") {
    return {
      headline: "Unlock Your",
      highlight: "Full Potential",
      subtitle: "Upgrade to Plus or Pro and get everything you need to reach your goals faster.",
      benefits: REWARDS_BENEFITS
    };
  }

  const copy = getFeatureLockCopy(featureKey);
  return {
    headline: copy.title || "Upgrade to unlock",
    highlight: "",
    subtitle: copy.description || "Upgrade your plan to unlock this Prelude feature.",
    benefits: REWARDS_BENEFITS
  };
}

export default function UpgradeLockModal({
  open,
  featureKey = "rewards",
  onClose,
  upgradeHref = `${STUDENT_DASHBOARD_BASE}/billing`
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useBelowHeaderModalOffset(open);

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

  const content = getModalContent(featureKey);

  return createPortal(
    <div
      className="dash-upgrade-lock dash-overlay--below-header"
      role="presentation"
      onMouseDown={(event) => {
        // Use mousedown so the same gesture that opened the modal
        // (Progress tab click under z-index 800) cannot immediately close it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="dash-upgrade-lock__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="dash-upgrade-lock__close"
          onClick={onClose}
          aria-label="Close"
        >
          <X aria-hidden="true" />
        </button>

        <div className="dash-upgrade-lock__visual" aria-hidden="true">
          <span className="dash-upgrade-lock__glow" />
          <span className="dash-upgrade-lock__float dash-upgrade-lock__float--coin-1">
            <Coins />
          </span>
          <span className="dash-upgrade-lock__float dash-upgrade-lock__float--star">
            <Sparkles />
          </span>
          <span className="dash-upgrade-lock__float dash-upgrade-lock__float--gift">
            <Gift />
          </span>
          <span className="dash-upgrade-lock__float dash-upgrade-lock__float--coin-2">
            <Coins />
          </span>
          <div className="dash-upgrade-lock__lock">
            <Lock />
          </div>
        </div>

        <div className="dash-upgrade-lock__copy">
          <h2 id={titleId} className="dash-upgrade-lock__title">
            {content.headline}
            {content.highlight ? (
              <>
                {" "}
                <span className="dash-upgrade-lock__title-accent">{content.highlight}</span>
              </>
            ) : null}
          </h2>
          <p id={descId} className="dash-upgrade-lock__subtitle">
            {content.subtitle}
          </p>
        </div>

        <ul className="dash-upgrade-lock__benefits">
          {content.benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li key={benefit.id} className={`dash-upgrade-lock__benefit dash-upgrade-lock__benefit--${benefit.tone}`}>
                <span className="dash-upgrade-lock__benefit-icon" aria-hidden="true">
                  <Icon />
                </span>
                <div className="dash-upgrade-lock__benefit-copy">
                  <strong>{benefit.title}</strong>
                  <span>{benefit.description}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="dash-upgrade-lock__actions">
          <Link
            to={upgradeHref}
            className="dash-btn dash-btn--primary dash-upgrade-lock__cta"
            onClick={onClose}
          >
            <Sparkles className="dash-upgrade-lock__cta-icon" aria-hidden="true" />
            Upgrade Now
          </Link>
          <button type="button" className="dash-upgrade-lock__later" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
