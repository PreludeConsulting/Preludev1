import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  ChevronRight,
  HelpCircle,
  Link2,
  Mail,
  Monitor,
  Pencil,
  Shield,
  User
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import IntegrationConnect from "../../components/IntegrationConnect.jsx";
import SettingsPageShell from "../../components/settings/SettingsPageShell.jsx";
import SecuritySettingsPanel from "../../components/settings/SecuritySettingsPanel.jsx";
import { SaveRow, SettingSelect, SettingToggle } from "../../components/settings/SettingsControls.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { loadPreferences, savePreferences } from "../../lib/dashboardPreferences.js";
import { SectionCard } from "../../components/ui/index.jsx";

const STUDENT_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Your account details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email and alerts" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Meetings and reminders" },
  { id: "display", label: "Display", icon: Monitor, description: "Layout and accessibility" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const MENTOR_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Mentor profile details" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

export function StudentSettingsPage() {
  const { user, planDetails, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount,
    savePreferences: savePrefsToBackend,
    useSupabaseData
  } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [savedSection, setSavedSection] = useState("");

  const roleLabel = "Student";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function saveSection(section) {
    savePreferences(prefs);
    if (useSupabaseData) {
      try {
        await savePrefsToBackend(prefs);
      } catch {
        /* local prefs still saved */
      }
    }
    setSavedSection(section);
    window.setTimeout(() => setSavedSection(""), 2600);
  }

  return (
    <SettingsPageShell
      user={user}
      roleLabel={roleLabel}
      planName={planName}
      tabs={STUDENT_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
    >
      {tab === "profile" ? (
        <>
          <SectionCard
            title="Profile information"
            className="dash-panel"
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/profile-stats`} className="dash-btn dash-btn--secondary dash-btn--sm">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit full profile
              </Link>
            }
          >
            <dl className="dash-kv">
              <div><dt>Name</dt><dd>{user?.name || "—"}</dd></div>
              <div><dt>Email</dt><dd>{user?.email || "—"}</dd></div>
              <div><dt>Role</dt><dd>{roleLabel}</dd></div>
              <div><dt>Plan</dt><dd>{planName}</dd></div>
            </dl>
            <p className="dash-muted">Manage academic details, intended majors, and college goals on your profile page.</p>
          </SectionCard>
        </>
      ) : null}

      {tab === "notifications" ? (
        <SectionCard title="Email &amp; notifications" className="dash-panel">
          <p className="dash-muted">Choose what Prelude notifies you about. Preferences are saved to this browser.</p>
          <SettingToggle id="emailUpdates" label="Product &amp; account emails" description="Important updates about your account." checked={prefs.emailUpdates} onChange={(v) => setPref("emailUpdates", v)} />
          <SettingToggle id="meetingReminders" label="Meeting reminders" description="Reminders before mentor sessions." checked={prefs.meetingReminders} onChange={(v) => setPref("meetingReminders", v)} />
          <SettingToggle id="mentorMessages" label="Mentor message alerts" description="Notify me when my mentor sends a message." checked={prefs.mentorMessages} onChange={(v) => setPref("mentorMessages", v)} />
          <SettingToggle id="weeklyDigest" label="Weekly progress digest" description="A summary of deadlines and progress each week." checked={prefs.weeklyDigest} onChange={(v) => setPref("weeklyDigest", v)} />
          <SettingToggle id="productTips" label="Tips &amp; best practices" description="Occasional admissions tips from Prelude." checked={prefs.productTips} onChange={(v) => setPref("productTips", v)} />
          <SaveRow section="notifications" savedSection={savedSection} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "calendar" ? (
        <SectionCard title="Calendar &amp; meeting preferences" className="dash-panel">
          <SettingSelect
            id="defaultCalendarView"
            label="Default calendar view"
            description="The view your calendar opens in."
            value={prefs.defaultCalendarView}
            onChange={(v) => setPref("defaultCalendarView", v)}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
              { value: "agenda", label: "Agenda" }
            ]}
          />
          <SettingSelect
            id="reminderLeadTime"
            label="Meeting reminder"
            description="How far ahead to remind you about sessions."
            value={prefs.reminderLeadTime}
            onChange={(v) => setPref("reminderLeadTime", v)}
            options={[
              { value: "10", label: "10 minutes before" },
              { value: "30", label: "30 minutes before" },
              { value: "60", label: "1 hour before" },
              { value: "1440", label: "1 day before" }
            ]}
          />
          <SettingSelect
            id="weekStart"
            label="Week starts on"
            value={prefs.weekStart}
            onChange={(v) => setPref("weekStart", v)}
            options={[
              { value: "sunday", label: "Sunday" },
              { value: "monday", label: "Monday" }
            ]}
          />
          <SaveRow section="calendar" savedSection={savedSection} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "display" ? (
        <SectionCard title="Display &amp; accessibility" className="dash-panel">
          <SettingSelect
            id="density"
            label="Layout density"
            description="Comfortable adds more spacing; compact fits more on screen."
            value={prefs.density}
            onChange={(v) => setPref("density", v)}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" }
            ]}
          />
          <SettingToggle
            id="reduceMotion"
            label="Reduce motion"
            description="Minimize animations across the dashboard."
            checked={prefs.reduceMotion}
            onChange={(v) => setPref("reduceMotion", v)}
          />
          <SaveRow section="display" savedSection={savedSection} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "integrations" ? (
        <SectionCard title="Connected accounts" className="dash-panel">
          <IntegrationConnect
            label="Google Calendar"
            connectLabel="Connect Google Calendar"
            connected={integrations.googleCalendar?.connected}
            onConnect={connectGoogle}
            onDisconnect={disconnectGoogle}
            description="Sync Prelude meetings and deadlines to your Google Calendar."
          />
          <IntegrationConnect
            label="Zoom"
            connectLabel="Connect Zoom Account"
            connected={integrations.zoom?.connected}
            onConnect={connectZoomAccount}
            onDisconnect={disconnectZoomAccount}
            description="Required for virtual mentor meetings."
          />
        </SectionCard>
      ) : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "support" ? (
        <SectionCard title="Support" className="dash-panel">
          <a className="dash-setting-link" href="mailto:hello@preludeconsulting.com">
            <span>
              <span className="dash-setting-link__label"><Mail className="h-4 w-4" aria-hidden="true" /> Contact support</span>
              <span className="dash-setting-link__desc">hello@preludeconsulting.com</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <button type="button" className="dash-setting-link" onClick={openAccount}>
            <span>
              <span className="dash-setting-link__label">Account &amp; plan</span>
              <span className="dash-setting-link__desc">View or change your subscription.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </SectionCard>
      ) : null}
    </SettingsPageShell>
  );
}

export function MentorSettingsPage() {
  const { user, planDetails, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount
  } = useDashboardData();
  const [tab, setTab] = useState("profile");

  const planName = planDetails?.name || user?.planName || "Basic";

  return (
    <SettingsPageShell
      user={user}
      roleLabel="Mentor"
      planName={planName}
      tabs={MENTOR_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
    >
      {tab === "profile" ? (
        <SectionCard title="Mentor profile" className="dash-panel">
          <dl className="dash-kv">
            <div><dt>Name</dt><dd>{user?.name || "—"}</dd></div>
            <div><dt>Email</dt><dd>{user?.email || "—"}</dd></div>
            <div><dt>Role</dt><dd>Mentor</dd></div>
            <div><dt>Plan</dt><dd>{planName}</dd></div>
          </dl>
          <p className="dash-muted">Full mentor profile editing is coming soon. Contact support if you need to update your university or bio.</p>
        </SectionCard>
      ) : null}

      {tab === "integrations" ? (
        <SectionCard title="Connected accounts" className="dash-panel">
          <IntegrationConnect
            label="Google Calendar"
            connectLabel="Connect Google Calendar"
            connected={integrations.googleCalendar?.connected}
            onConnect={connectGoogle}
            onDisconnect={disconnectGoogle}
          />
          <IntegrationConnect
            label="Zoom"
            connectLabel="Connect Zoom Account"
            connected={integrations.zoom?.connected}
            onConnect={connectZoomAccount}
            onDisconnect={disconnectZoomAccount}
          />
        </SectionCard>
      ) : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "support" ? (
        <SectionCard title="Support" className="dash-panel">
          <a className="dash-setting-link" href="mailto:hello@preludeconsulting.com">
            <span>
              <span className="dash-setting-link__label"><Mail className="h-4 w-4" aria-hidden="true" /> Contact support</span>
              <span className="dash-setting-link__desc">hello@preludeconsulting.com</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </SectionCard>
      ) : null}
    </SettingsPageShell>
  );
}

/** @deprecated Use StudentSettingsPage */
export const StudentProfileSettings = StudentSettingsPage;

/** @deprecated Use MentorSettingsPage */
export const MentorProfileSettings = MentorSettingsPage;
