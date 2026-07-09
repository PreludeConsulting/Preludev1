import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  LifeBuoy,
  Mail,
  MessageCircle,
  Settings,
  Sparkles
} from "lucide-react";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { cn } from "../../../lib/utils.js";
import { PrimaryButton } from "../ui/index.jsx";

const SUPPORT_EMAIL = "support@preludeconsultingllc.com";

const SUPPORT_ACTIONS = [
  {
    id: "contact",
    title: "Contact Support",
    description: "Email our team for account and billing help.",
    href: `mailto:${SUPPORT_EMAIL}`,
    icon: Mail,
    external: true
  },
  {
    id: "meeting",
    title: "Schedule a Meeting",
    description: "Request time with your mentor from Calendar.",
    to: `${STUDENT_DASHBOARD_BASE}/calendar`,
    icon: Calendar
  },
  {
    id: "billing",
    title: "Plans & Billing",
    description: "Review your plan and subscription details.",
    to: `${STUDENT_DASHBOARD_BASE}/billing`,
    icon: CreditCard
  },
  {
    id: "settings",
    title: "Account Settings",
    description: "Update your profile, family, and preferences.",
    to: `${STUDENT_DASHBOARD_BASE}/settings`,
    icon: Settings
  }
];

const FAQ_ITEMS = [
  {
    id: "schedule",
    question: "How do I schedule a mentor session?",
    answer: "Go to Calendar or My Mentor and submit a meeting request. Your mentor will confirm the time.",
    keywords: ["calendar", "meeting", "mentor", "schedule"]
  },
  {
    id: "plan",
    question: "Can I change my plan?",
    answer: "Yes — visit Plans & Billing or Account Settings to select a different plan.",
    keywords: ["billing", "subscription", "upgrade", "plan"]
  },
  {
    id: "messages",
    question: "Where are my messages?",
    answer: "Open Messages from the dashboard menu to view conversations with your mentor.",
    keywords: ["messages", "chat", "inbox", "mentor"]
  },
  {
    id: "colleges",
    question: "How do I save colleges?",
    answer: "Visit the Colleges tab and click Save College on any school you want to add to your list.",
    keywords: ["colleges", "save", "school list", "applications"]
  },
  {
    id: "progress",
    question: "Where can I track my progress?",
    answer: "Go to Progress to view milestones, updates, and next steps.",
    keywords: ["progress", "milestones", "tasks", "rewards"]
  }
];

const QUICK_LINKS = [
  { label: "Settings", to: `${STUDENT_DASHBOARD_BASE}/settings`, icon: Settings },
  { label: "Plans & Billing", to: `${STUDENT_DASHBOARD_BASE}/billing`, icon: CreditCard },
  { label: "Back to Prelude homepage", to: "/", icon: Sparkles, external: true }
];

function SupportActionCard({ action }) {
  const Icon = action.icon;
  const content = (
    <>
      <span className="dash-help-center__action-icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="dash-help-center__action-copy">
        <strong>{action.title}</strong>
        <span>{action.description}</span>
      </span>
      {action.external ? <ExternalLink className="dash-help-center__action-arrow h-4 w-4" aria-hidden="true" /> : null}
    </>
  );

  const className = "dash-help-center__action-card";

  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {content}
      </a>
    );
  }

  return (
    <Link to={action.to} className={className}>
      {content}
    </Link>
  );
}

function HelpFaqAccordion({ items, openId, onToggle }) {
  return (
    <div className="dash-help-center__faq-list">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id} className={cn("dash-help-center__faq-item", open && "dash-help-center__faq-item--open")}>
            <button
              type="button"
              className="dash-help-center__faq-trigger"
              aria-expanded={open}
              onClick={() => onToggle(open ? null : item.id)}
            >
              <span>{item.question}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="dash-help-center__faq-panel" hidden={!open}>
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StudentHelpSupport() {
  const [openFaqId, setOpenFaqId] = useState(null);

  return (
    <div className="dash-page dash-page--premium dash-help-center">
      <section className="dash-help-center__hero dash-panel">
        <div className="dash-help-center__hero-top">
          <span className="dash-help-center__badge">
            <LifeBuoy className="h-4 w-4" aria-hidden="true" />
            Support center
          </span>
          <h1 className="dash-help-center__title">Help &amp; Support</h1>
          <p className="dash-help-center__subtitle">
            Get answers, manage your account, and contact the Prelude team.
          </p>
        </div>
      </section>

      <section className="dash-help-center__actions" aria-label="Support actions">
        {SUPPORT_ACTIONS.map((action) => (
          <SupportActionCard key={action.id} action={action} />
        ))}
      </section>

      <div className="dash-help-center__main">
        <section className="dash-help-center__contact dash-panel" aria-labelledby="help-contact-heading">
          <div className="dash-help-center__section-head">
            <span className="dash-help-center__section-icon" aria-hidden="true">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <h2 id="help-contact-heading">Email Support</h2>
              <p className="dash-muted">Best for account, billing, and general support questions.</p>
            </div>
          </div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="dash-help-center__email">
            {SUPPORT_EMAIL}
          </a>
          <p className="dash-help-center__response-time">Typical response time: within 1 business day</p>
          <div className="dash-help-center__contact-links">
            <Link to={`${STUDENT_DASHBOARD_BASE}/messages`} className="dash-help-center__inline-link">
              <MessageCircle className="h-4 w-4" /> Messages
            </Link>
            <Link to={`${STUDENT_DASHBOARD_BASE}/mentor`} className="dash-help-center__inline-link">
              <GraduationCap className="h-4 w-4" /> My Mentor
            </Link>
          </div>
        </section>

        <section className="dash-help-center__faq dash-panel" aria-labelledby="help-faq-heading">
          <div className="dash-help-center__section-head">
            <span className="dash-help-center__section-icon" aria-hidden="true">
              <HelpCircle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="help-faq-heading">Common questions</h2>
              <p className="dash-muted">Quick answers to the topics students ask about most.</p>
            </div>
          </div>
          <HelpFaqAccordion items={FAQ_ITEMS} openId={openFaqId} onToggle={setOpenFaqId} />
        </section>
      </div>

      <section className="dash-help-center__quick" aria-labelledby="help-quick-heading">
        <div className="dash-help-center__quick-head">
          <h2 id="help-quick-heading">Quick links</h2>
          <p className="dash-muted">Jump to the tools you use most.</p>
        </div>
        <div className="dash-help-center__quick-grid">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            const className = "dash-help-center__quick-card";
            if (link.external) {
              return (
                <a key={link.label} href={link.to} className={className}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{link.label}</span>
                </a>
              );
            }
            return (
              <Link key={link.label} to={link.to} className={className}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="dash-help-center__cta dash-panel">
        <div className="dash-help-center__cta-copy">
          <h2>Still need help?</h2>
          <p>Reach out to our team and we&apos;ll point you in the right direction.</p>
        </div>
        <PrimaryButton as="a" href={`mailto:${SUPPORT_EMAIL}`} className="dash-btn--sm">
          <Mail className="h-4 w-4" /> Contact Support
        </PrimaryButton>
      </section>
    </div>
  );
}
