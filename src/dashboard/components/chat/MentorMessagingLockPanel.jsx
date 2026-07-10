import { Lock, MessageCircle, Send, Sparkles, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";

const BENEFITS = [
  { id: "message", label: "Message mentors directly", icon: Send },
  { id: "feedback", label: "Get faster application feedback", icon: Zap },
  { id: "network", label: "Access the full mentor network", icon: Users }
];

export default function MentorMessagingLockPanel({
  upgradeHref = `${STUDENT_DASHBOARD_BASE}/billing`,
  className = ""
}) {
  return (
    <div className={`dash-msg-lock${className ? ` ${className}` : ""}`}>
      <div className="dash-msg-lock__visual" aria-hidden="true">
        <span className="dash-msg-lock__glow" />
        <span className="dash-msg-lock__spark dash-msg-lock__spark--1">
          <Sparkles />
        </span>
        <span className="dash-msg-lock__spark dash-msg-lock__spark--2">+</span>
        <div className="dash-msg-lock__bubble">
          <MessageCircle />
          <span className="dash-msg-lock__dots">
            <i />
            <i />
            <i />
          </span>
        </div>
        <span className="dash-msg-lock__padlock">
          <Lock />
        </span>
      </div>

      <div className="dash-msg-lock__divider" aria-hidden="true" />

      <div className="dash-msg-lock__content">
        <div className="dash-msg-lock__copy">
          <span className="dash-msg-lock__eyebrow" aria-hidden="true">
            <Lock />
          </span>
          <h3 className="dash-msg-lock__title">Unlock Mentor Messaging</h3>
          <p className="dash-msg-lock__subtitle">
            Upgrade to <em>Plus</em> or <em>Pro</em> to message mentors across the Prelude network and get faster
            guidance when you need it.
          </p>
        </div>

        <ul className="dash-msg-lock__benefits">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <li key={benefit.id} className="dash-msg-lock__benefit">
                <span className="dash-msg-lock__benefit-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>{benefit.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="dash-msg-lock__actions">
          <Link to={upgradeHref} className="dash-btn dash-btn--primary dash-msg-lock__cta">
            <Lock className="dash-msg-lock__cta-icon" aria-hidden="true" />
            Upgrade Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
