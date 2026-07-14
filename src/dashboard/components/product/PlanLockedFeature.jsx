import { BookOpen, Coins, Gift, GraduationCap, Lock, Sparkles, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getFeatureLockCopy, PRICING_UPGRADE_TO } from "../../../lib/planFeatures.js";
import { PrimaryButton } from "../ui/index.jsx";

const SESSION_UNLOCK_FEATURES = [
  { id: "credits", label: "1-on-1 credits", Icon: User, tone: "violet" },
  { id: "college", label: "College consulting", Icon: GraduationCap, tone: "rose" },
  { id: "tutoring", label: "SAT/ACT & tutoring", Icon: BookOpen, tone: "amber" }
];

const PRO_BOOST_FEATURES = [
  { id: "coins", label: "25% more coins", Icon: User, tone: "violet" },
  { id: "rewards", label: "Higher-value rewards", Icon: Gift, tone: "amber" }
];

function AccentTitle({ title }) {
  if (title === "Upgrade to unlock") {
    return (
      <>
        Upgrade to <span className="dash-plan-locked__title-accent">unlock</span>
      </>
    );
  }
  if (title === "Unlock Pro Boost") {
    return (
      <>
        Unlock <span className="dash-plan-locked__title-accent">Pro Boost</span>
      </>
    );
  }
  return title;
}

function UnlockIllustration({ compact = false }) {
  return (
    <div className={`dash-plan-locked__art${compact ? " dash-plan-locked__art--compact" : ""}`} aria-hidden="true">
      <div className="dash-plan-locked__art-glow" />
      <div className="dash-plan-locked__art-ring dash-plan-locked__art-ring--outer" />
      <div className="dash-plan-locked__art-ring dash-plan-locked__art-ring--inner" />
      <div className="dash-plan-locked__art-core">
        <Lock className="dash-plan-locked__art-lock" />
      </div>
      <span className="dash-plan-locked__art-float dash-plan-locked__art-float--gift">
        <Gift />
      </span>
      <span className="dash-plan-locked__art-float dash-plan-locked__art-float--user">
        <User />
      </span>
      <span className="dash-plan-locked__art-float dash-plan-locked__art-float--coins">
        <Coins />
      </span>
      <span className="dash-plan-locked__art-spark dash-plan-locked__art-spark--a" />
      <span className="dash-plan-locked__art-spark dash-plan-locked__art-spark--b" />
      <span className="dash-plan-locked__art-spark dash-plan-locked__art-spark--c" />
    </div>
  );
}

function SessionUnlockLayout({ copy, actionLabel }) {
  return (
    <div className="dash-plan-locked dash-plan-locked--session-unlock">
      <div className="dash-plan-locked__session-grid">
        <div className="dash-plan-locked__session-content">
          <div className="dash-plan-locked__icon-wrap" aria-hidden="true">
            <Lock className="dash-plan-locked__icon" />
          </div>
          <div className="dash-plan-locked__copy">
            <h3 className="dash-plan-locked__title">
              <AccentTitle title={copy.title} />
            </h3>
            {copy.description ? <p className="dash-plan-locked__desc">{copy.description}</p> : null}
          </div>
          <ul className="dash-plan-locked__features">
            {SESSION_UNLOCK_FEATURES.map(({ id, label, Icon, tone }) => (
              <li key={id} className={`dash-plan-locked__feature dash-plan-locked__feature--${tone}`}>
                <Icon className="dash-plan-locked__feature-icon" aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton as={Link} to={PRICING_UPGRADE_TO} className="dash-plan-locked__cta dash-plan-locked__cta--session">
            <Sparkles className="dash-plan-locked__cta-icon" aria-hidden="true" />
            {actionLabel}
          </PrimaryButton>
        </div>
        <UnlockIllustration />
      </div>
    </div>
  );
}

function ProBoostUnlockLayout({ actionLabel, className = "" }) {
  return (
    <div className={`dash-plan-locked dash-plan-locked--session-unlock dash-plan-locked--pro-boost${className ? ` ${className}` : ""}`}>
      <div className="dash-plan-locked__session-grid">
        <div className="dash-plan-locked__session-content">
          <div className="dash-plan-locked__heading-row">
            <div className="dash-plan-locked__icon-wrap" aria-hidden="true">
              <Lock className="dash-plan-locked__icon" />
            </div>
            <h3 className="dash-plan-locked__title">
              <AccentTitle title="Unlock Pro Boost" />
            </h3>
          </div>
          <ul className="dash-plan-locked__features">
            {PRO_BOOST_FEATURES.map(({ id, label, Icon, tone }) => (
              <li key={id} className={`dash-plan-locked__feature dash-plan-locked__feature--${tone}`}>
                <span className="dash-plan-locked__feature-icon-wrap" aria-hidden="true">
                  <Icon className="dash-plan-locked__feature-icon" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton as={Link} to={PRICING_UPGRADE_TO} className="dash-plan-locked__cta dash-plan-locked__cta--session">
            <Sparkles className="dash-plan-locked__cta-icon" aria-hidden="true" />
            {actionLabel}
          </PrimaryButton>
        </div>
        <UnlockIllustration compact />
      </div>
    </div>
  );
}

export default function PlanLockedFeature({
  feature,
  title,
  description,
  benefits,
  actionLabel = "View Plans",
  compact = false,
  variant = "default",
  className = ""
}) {
  const copy = title ? { title, description } : getFeatureLockCopy(feature);

  if (variant === "sessionUnlock") {
    return <SessionUnlockLayout copy={copy} actionLabel={actionLabel} />;
  }

  if (variant === "proBoostUnlock") {
    return <ProBoostUnlockLayout actionLabel={actionLabel} className={className} />;
  }

  return (
    <div className={`dash-plan-locked${compact ? " dash-plan-locked--compact" : ""}${className ? ` ${className}` : ""}`}>
      <div className="dash-plan-locked__icon-wrap" aria-hidden="true">
        <Lock className="dash-plan-locked__icon" />
      </div>
      <div className="dash-plan-locked__copy">
        <h3 className="dash-plan-locked__title">{copy.title}</h3>
        {copy.description ? <p className="dash-plan-locked__desc">{copy.description}</p> : null}
        {benefits?.length ? (
          <ul className="dash-plan-locked__benefits">
            {benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <PrimaryButton as={Link} to={PRICING_UPGRADE_TO} className="dash-plan-locked__cta">
        {actionLabel}
      </PrimaryButton>
    </div>
  );
}
