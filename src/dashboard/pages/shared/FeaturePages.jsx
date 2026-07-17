import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  HelpCircle,
  Mail,
  MessageCircle,
  Sparkles,
  Target,
  Users
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { getPlan, getPricingPlans } from "../../../lib/plans.js";
import { PARENT_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import StudentHelpSupport from "../../components/product/StudentHelpSupport.jsx";
import StudentBillingPage from "../../components/product/StudentBillingPage.jsx";
import BillingMembershipPanel from "../../components/settings/BillingMembershipPanel.jsx";
import NotificationActions from "../../components/NotificationActions.jsx";
import {
  DashboardPageHeader,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SectionCard
} from "../../components/ui/index.jsx";

const MATCHING_QUESTIONS = [
  "What are your top intended majors or fields of study?",
  "Which colleges or regions are you most interested in?",
  "What kind of mentor support would help you most right now?",
  "How often would you like to meet with a mentor?"
];

export function StudentNotifications() {
  const { notifications, loading, markAllNotificationsRead, isDemo } = useDashboardData();
  const unread = notifications.filter((n) => n.unread);

  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Notifications"
        subtitle="Updates about meetings, messages, and your application progress."
        actions={
          unread.length ? (
            <SecondaryButton type="button" className="dash-btn--sm" onClick={markAllNotificationsRead}>
              Mark all read
            </SecondaryButton>
          ) : null
        }
      />

      {loading ? <p className="dash-muted" role="status" aria-live="polite">Loading notifications…</p> : null}

      {!loading && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New updates about meetings, messages, and your application progress will appear here."
        />
      ) : null}

      {notifications.length > 0 ? (
        <ul className="dash-notification-list">
          {notifications.map((n) => (
            <li key={n.id} className={`dash-notification-item ${n.unread ? "dash-notification-item--unread" : ""}`}>
              <div>
                <p className="dash-notification-item__title">{n.title}</p>
                {n.body ? <p className="dash-notification-item__body">{n.body}</p> : null}
                {n.createdAt ? (
                  <p className="dash-muted dash-notification-item__time">
                    {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                ) : null}
              </div>
              {n.link || n.actionType ? <NotificationActions notification={n} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {isDemo ? <p className="dash-demo-note">Demo content — your live account starts with an empty notification center.</p> : null}
    </div>
  );
}

export function StudentBilling() {
  return <StudentBillingPage />;
}

export function StudentHelp() {
  return <StudentHelpSupport />;
}

export function StudentMentorMatching() {
  const { onboarding, saveOnboarding, useSupabaseData } = useDashboardData();
  const [answers, setAnswers] = useState(onboarding?.questionnaireAnswers || {});
  const [step, setStep] = useState(onboarding?.mentorMatchingStarted ? 1 : 0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    setStep(1);
    setError("");
    if (useSupabaseData) {
      try {
        await saveOnboarding({ mentorMatchingStarted: true });
      } catch (err) {
        setError(err.message || "Could not save your progress. Try again.");
        setStep(0);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (useSupabaseData) {
        await saveOnboarding({
          mentorMatchingStarted: true,
          mentorMatchingComplete: true,
          questionnaireAnswers: answers
        });
      }
      setSaved(true);
      setStep(2);
    } catch (err) {
      setError(err.message || "Could not save your preferences. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (onboarding?.mentorMatchingComplete || step === 2 || saved) {
    return (
      <div className="dash-page dash-page--premium">
        <DashboardPageHeader
          title="Mentor Matching"
          subtitle="We're preparing your mentor recommendations."
        />
        <SectionCard className="dash-panel">
          <EmptyState
            icon={Users}
            title="Matching in progress"
            description="Your preferences have been saved. Prelude will notify you when a mentor match is ready. Full automated matching will connect when the mentor network is live."
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/mentor`} className="dash-btn dash-btn--primary dash-btn--sm">
                View My Mentors
              </Link>
            }
          />
        </SectionCard>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="dash-page dash-page--premium">
        <DashboardPageHeader
          title="Mentor Matching"
          subtitle="Tell us about your goals so we can connect you with the right mentor."
        />
        <SectionCard className="dash-panel dash-matching-intro">
          <Target className="h-10 w-10 text-primary" aria-hidden="true" />
          <h2>Find your Prelude mentor</h2>
          <p className="dash-muted">
            Answer a few questions about your academic interests and preferences.
            Your responses are saved to your account and used when matching becomes available.
          </p>
          <PrimaryButton type="button" onClick={handleStart}>Start Matching</PrimaryButton>
          {error ? <p className="dash-save-state dash-save-state--error">{error}</p> : null}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Mentor questionnaire"
        subtitle="Step 1 of 1 — help us understand what you're looking for."
      />
      <form className="dash-matching-form" onSubmit={handleSubmit}>
        {MATCHING_QUESTIONS.map((q, i) => (
          <label key={q} className="prelude-field">
            <span>{q}</span>
            <textarea
              rows={3}
              required
              value={answers[`q${i}`] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [`q${i}`]: e.target.value }))}
              placeholder="Your answer…"
            />
          </label>
        ))}
        <div className="dash-form-actions">
          {error ? <span className="dash-save-state dash-save-state--error">{error}</span> : null}
          <SecondaryButton type="button" onClick={() => setStep(0)}>Back</SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Submit preferences"}</PrimaryButton>
        </div>
      </form>
    </div>
  );
}

export function MentorHelp() {
  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader title="Help and Support" subtitle="Resources for Prelude mentors." />
      <SectionCard className="dash-panel">
        <a href="mailto:preludesupport@preludeconsultingllc.com" className="dash-help-card">
          <Mail className="h-5 w-5" />
          <div>
            <strong>Contact mentor support</strong>
            <p className="dash-muted">preludesupport@preludeconsultingllc.com</p>
          </div>
        </a>
        <Link to="/" className="dash-btn dash-btn--secondary dash-btn--sm">Back to homepage</Link>
      </SectionCard>
    </div>
  );
}

export function MentorNotifications() {
  const { notifications, markAllNotificationsRead } = useDashboardData();
  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader title="Notifications" subtitle="Student requests and schedule updates." />
      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="New updates will appear here." />
      ) : (
        <ul className="dash-notification-list">
          {notifications.map((n) => (
            <li key={n.id} className="dash-notification-item">{n.title}{n.body ? ` — ${n.body}` : ""}</li>
          ))}
        </ul>
      )}
      {notifications.some((n) => n.unread) ? (
        <SecondaryButton type="button" className="dash-btn--sm" onClick={markAllNotificationsRead}>Mark all read</SecondaryButton>
      ) : null}
    </div>
  );
}

export function ParentNotifications() {
  const { notifications, loading, markAllNotificationsRead } = useDashboardData();
  const unread = notifications.filter((n) => n.unread);

  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Notifications"
        subtitle="Updates about your children's meetings, mentors, and progress."
        actions={
          unread.length ? (
            <SecondaryButton type="button" className="dash-btn--sm" onClick={markAllNotificationsRead}>
              Mark all read
            </SecondaryButton>
          ) : null
        }
      />

      {loading ? <p className="dash-muted" role="status" aria-live="polite">Loading notifications…</p> : null}

      {!loading && notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New updates about your children's meetings, mentor messages, and deadlines will appear here."
        />
      ) : null}

      {notifications.length > 0 ? (
        <ul className="dash-notification-list">
          {notifications.map((n) => (
            <li key={n.id} className={`dash-notification-item ${n.unread ? "dash-notification-item--unread" : ""}`}>
              <div>
                <p className="dash-notification-item__title">{n.title}</p>
                {n.body ? <p className="dash-notification-item__body">{n.body}</p> : null}
                {n.createdAt ? (
                  <p className="dash-muted dash-notification-item__time">
                    {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                ) : null}
              </div>
              {n.link || n.actionType ? <NotificationActions notification={n} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ParentBilling() {
  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Plans and Billing"
        subtitle="Shared household membership, session balance, and purchase history."
      />
      <BillingMembershipPanel settingsBasePath={`${PARENT_DASHBOARD_BASE}/settings`} />
    </div>
  );
}

export function ParentHelp() {
  return (
    <div className="dash-page dash-page--premium">
      <DashboardPageHeader
        title="Help and Support"
        subtitle="Get answers and contact the Prelude team as a parent."
      />

      <div className="dash-help-grid">
        <SectionCard title="Contact us" className="dash-panel">
          <a href="mailto:preludesupport@preludeconsultingllc.com" className="dash-help-card">
            <Mail className="h-5 w-5" />
            <div>
              <strong>Email support</strong>
              <p className="dash-muted">preludesupport@preludeconsultingllc.com — we typically respond within one business day.</p>
            </div>
          </a>
        </SectionCard>

        <SectionCard title="Common questions" className="dash-panel">
          <dl className="dash-faq">
            <div>
              <dt>How do I link my child&apos;s account?</dt>
              <dd>Ask your student to enter your email when they sign up, or invite you from their Prelude Settings → Family tab.</dd>
            </div>
            <div>
              <dt>Can I message my child&apos;s mentor?</dt>
              <dd>Yes — use the Messages button in the dashboard to chat with each mentor connected to your children.</dd>
            </div>
            <div>
              <dt>How do I switch between children?</dt>
              <dd>From Home, open a child&apos;s dashboard. Use the child switcher at the top to move between linked students.</dd>
            </div>
            <div>
              <dt>Can I edit my child&apos;s calendar?</dt>
              <dd>Parents can add and edit calendar events for linked children, but cannot remove events created by the student or mentor.</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Quick links" className="dash-panel">
          <div className="dash-help-links">
            <Link to={`${PARENT_DASHBOARD_BASE}/settings`}><Users className="h-4 w-4" /> Profile &amp; settings</Link>
            <Link to={`${PARENT_DASHBOARD_BASE}/billing`}><CreditCard className="h-4 w-4" /> Plans and billing</Link>
            <Link to={`${PARENT_DASHBOARD_BASE}/overview`}><Users className="h-4 w-4" /> My children</Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
