import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Calendar,
  Camera,
  ChevronRight,
  HelpCircle,
  Link2,
  Mail,
  Monitor,
  Pencil,
  Shield,
  User,
  Users
} from "lucide-react";
import ParentGuardianSettingsPanel from "../../components/settings/ParentGuardianSettingsPanel.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PARENT_DASHBOARD_BASE, STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import { getDemoLinkedChildren, listLinkedChildren } from "../../../lib/parentLinks.js";
import { shouldUseDemoFixtures } from "../../../lib/devAuthBypass.js";
import { removeAvatar, uploadAvatar, validateAvatarFile } from "../../../lib/supabaseStorage.js";
import IntegrationConnect from "../../components/IntegrationConnect.jsx";
import SettingsPageShell from "../../components/settings/SettingsPageShell.jsx";
import SecuritySettingsPanel from "../../components/settings/SecuritySettingsPanel.jsx";
import { SaveRow, SettingSelect, SettingToggle } from "../../components/settings/SettingsControls.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { loadPreferences, savePreferences } from "../../lib/dashboardPreferences.js";
import { SecondaryButton, SectionCard } from "../../components/ui/index.jsx";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "zh", label: "Chinese" }
];

const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" }
];

function cleanText(value) {
  return String(value || "").trim();
}

function accountFormFromUser(user, profile, fallbackRole) {
  return {
    fullName: profile?.fullName || user?.name || "",
    preferredName: profile?.preferredName || "",
    school: profile?.school || "",
    graduationYear: profile?.graduationYear || "",
    gradeLevel: profile?.grade || "",
    timeZone: profile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    language: profile?.language || "en",
    locationCityState: profile?.locationCityState || "",
    email: profile?.email || user?.email || "",
    role: profile?.role || user?.role || fallbackRole,
    avatarUrl: profile?.avatarUrl || user?.avatarUrl || ""
  };
}

function validateAccountForm(form) {
  const errors = {};
  if (!cleanText(form.fullName)) errors.fullName = "Enter your full name.";
  const year = cleanText(form.graduationYear);
  if (year && (!/^\d{4}$/.test(year) || Number(year) < 2020 || Number(year) > 2045)) {
    errors.graduationYear = "Use a four-digit year between 2020 and 2045.";
  }
  if (cleanText(form.locationCityState) && !/^[a-zA-Z\s.'-]+,\s*[a-zA-Z]{2,}$/.test(cleanText(form.locationCityState))) {
    errors.locationCityState = "Use city and state, for example Atlanta, GA.";
  }
  return errors;
}

function AccountSettingsPanel({ user, profile, roleLabel, useSupabaseData, saveProfile }) {
  const initialForm = useMemo(() => accountFormFromUser(user, profile, roleLabel.toLowerCase()), [user, profile, roleLabel]);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ status: "idle", message: "" });
  const [avatarState, setAvatarState] = useState({ status: "idle", message: "" });
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(initialForm);
    setErrors({});
    setBrokenAvatar(false);
  }, [initialForm]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initialForm);
  const displayName = form.preferredName || form.fullName || user?.name || "Prelude";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "P";

  useEffect(() => {
    function beforeUnload(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function handleSave() {
    const nextErrors = validateAccountForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setState({ status: "error", message: "Fix the highlighted fields before saving." });
      return;
    }
    setState({ status: "saving", message: "" });
    try {
      const payload = {
        fullName: cleanText(form.fullName),
        preferredName: cleanText(form.preferredName),
        school: cleanText(form.school),
        graduationYear: cleanText(form.graduationYear),
        gradeLevel: cleanText(form.gradeLevel),
        timeZone: form.timeZone,
        language: form.language,
        locationCityState: cleanText(form.locationCityState)
      };
      await saveProfile(payload);
      setState({ status: "saved", message: "Account settings saved." });
      window.setTimeout(() => setState((current) => current.status === "saved" ? { status: "idle", message: "" } : current), 2400);
    } catch {
      setState({ status: "error", message: "We could not save those settings. Try again." });
    }
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateAvatarFile(file);
    if (validation) {
      setAvatarState({ status: "error", message: validation });
      event.target.value = "";
      return;
    }
    if (!useSupabaseData) {
      setAvatarState({ status: "error", message: "Profile photo upload requires a signed-in Supabase session." });
      event.target.value = "";
      return;
    }
    setAvatarState({ status: "saving", message: "" });
    try {
      const { url, error } = await uploadAvatar(user.id, file);
      if (error) throw new Error(error);
      setForm((current) => ({ ...current, avatarUrl: url || "" }));
      await saveProfile({ avatarUrl: url || "" }, { localOnly: true });
      setBrokenAvatar(false);
      setAvatarState({ status: "saved", message: "Profile photo updated." });
    } catch (error) {
      setAvatarState({ status: "error", message: error?.message || "We could not update your photo. Try another image." });
    } finally {
      event.target.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (!form.avatarUrl) return;
    if (!useSupabaseData) {
      setAvatarState({ status: "error", message: "Profile photo removal requires a signed-in Supabase session." });
      return;
    }
    setAvatarState({ status: "saving", message: "" });
    try {
      const { error } = await removeAvatar(user.id);
      if (error) throw new Error(error);
      setForm((current) => ({ ...current, avatarUrl: "" }));
      await saveProfile({ avatarUrl: null }, { localOnly: true });
      setBrokenAvatar(false);
      setAvatarState({ status: "saved", message: "Profile photo removed." });
    } catch (error) {
      setAvatarState({ status: "error", message: error?.message || "We could not remove your photo. Try again." });
    }
  }

  return (
    <SectionCard title="Account settings" className="dash-panel">
      <div className="dash-account-settings">
        <div className="dash-avatar-editor">
          <div className="dash-avatar-editor__preview" aria-label="Profile photo preview">
            {form.avatarUrl && !brokenAvatar ? (
              <img src={form.avatarUrl} alt="" onError={() => setBrokenAvatar(true)} />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div className="dash-avatar-editor__actions">
            <input ref={fileRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarFile} />
            <SecondaryButton type="button" className="dash-btn--sm" onClick={() => fileRef.current?.click()} disabled={avatarState.status === "saving"}>
              <Camera className="h-4 w-4" aria-hidden="true" /> {form.avatarUrl ? "Replace photo" : "Upload photo"}
            </SecondaryButton>
            {form.avatarUrl ? (
              <SecondaryButton type="button" className="dash-btn--sm" onClick={handleRemoveAvatar} disabled={avatarState.status === "saving"}>
                Remove
              </SecondaryButton>
            ) : null}
            <p className="dash-setting-row__desc">JPG, PNG, WebP, or GIF. Max 5 MB.</p>
            {avatarState.status === "saving" ? <span className="dash-save-state" role="status">Updating photo…</span> : null}
            {avatarState.status === "saved" ? <span className="dash-save-state dash-save-state--ok" role="status">{avatarState.message}</span> : null}
            {avatarState.status === "error" ? <span className="dash-save-state dash-save-state--error" role="alert">{avatarState.message}</span> : null}
          </div>
        </div>

        <div className="dash-form-grid dash-form-grid--settings">
          <label className="dash-field">
            <span>Full name</span>
            <input className="dash-input" value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} />
            {errors.fullName ? <em>{errors.fullName}</em> : null}
          </label>
          <label className="dash-field">
            <span>Preferred name</span>
            <input className="dash-input" value={form.preferredName} onChange={(event) => updateField("preferredName", event.target.value)} />
          </label>
          <label className="dash-field">
            <span>Email</span>
            <input className="dash-input" value={form.email} readOnly aria-readonly="true" />
          </label>
          <label className="dash-field">
            <span>Role</span>
            <input className="dash-input" value={roleLabel} readOnly aria-readonly="true" />
          </label>
          <label className="dash-field">
            <span>School</span>
            <input className="dash-input" value={form.school} onChange={(event) => updateField("school", event.target.value)} />
          </label>
          <label className="dash-field">
            <span>Graduation year</span>
            <input className="dash-input" inputMode="numeric" value={form.graduationYear} onChange={(event) => updateField("graduationYear", event.target.value)} aria-invalid={Boolean(errors.graduationYear)} />
            {errors.graduationYear ? <em>{errors.graduationYear}</em> : null}
          </label>
          <label className="dash-field">
            <span>Grade level</span>
            <select className="dash-select" value={form.gradeLevel} onChange={(event) => updateField("gradeLevel", event.target.value)}>
              <option value="">Not set</option>
              <option value="9th">9th grade</option>
              <option value="10th">10th grade</option>
              <option value="11th">11th grade</option>
              <option value="12th">12th grade</option>
              <option value="College">College</option>
              <option value="Guardian">Guardian</option>
            </select>
          </label>
          <label className="dash-field">
            <span>Time zone</span>
            <select className="dash-select" value={form.timeZone} onChange={(event) => updateField("timeZone", event.target.value)}>
              {TIME_ZONE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="dash-field">
            <span>Language</span>
            <select className="dash-select" value={form.language} onChange={(event) => updateField("language", event.target.value)}>
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="dash-field">
            <span>City, state</span>
            <input className="dash-input" placeholder="Atlanta, GA" value={form.locationCityState} onChange={(event) => updateField("locationCityState", event.target.value)} aria-invalid={Boolean(errors.locationCityState)} />
            {errors.locationCityState ? <em>{errors.locationCityState}</em> : null}
          </label>
        </div>

        <div className="dash-form-actions">
          {dirty ? <span className="dash-save-state" role="status">Unsaved changes</span> : null}
          {state.status === "saved" ? <span className="dash-save-state dash-save-state--ok" role="status">{state.message}</span> : null}
          {state.status === "error" ? <span className="dash-save-state dash-save-state--error" role="alert">{state.message}</span> : null}
          <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setForm(initialForm)} disabled={!dirty || state.status === "saving"}>Cancel</SecondaryButton>
          <button type="button" className="dash-btn dash-btn--primary dash-btn--sm" onClick={handleSave} disabled={!dirty || state.status === "saving"}>
            {state.status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

const STUDENT_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Your account details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email and alerts" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Meetings and reminders" },
  { id: "display", label: "Display", icon: Monitor, description: "Layout and accessibility" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "family", label: "Family", icon: Users, description: "Parents and guardians" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "privacy", label: "Privacy & data", icon: Shield, description: "Visibility and data requests" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const MENTOR_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Mentor profile details" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "support", label: "Support", icon: HelpCircle, description: "Help and contact" }
];

const PARENT_SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: User, description: "Your account details" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email and alerts" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Meetings and reminders" },
  { id: "display", label: "Display", icon: Monitor, description: "Layout and accessibility" },
  { id: "integrations", label: "Connected accounts", icon: Link2, description: "Google and Zoom" },
  { id: "security", label: "Security", icon: Shield, description: "Password and deletion" },
  { id: "privacy", label: "Privacy & data", icon: Shield, description: "Visibility and data requests" },
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
    saveProfile,
    useSupabaseData,
    preferences: loadedPreferences,
    profile
  } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (hash && STUDENT_SETTINGS_TABS.some((item) => item.id === hash)) {
      setTab(hash);
    }
  }, []);

  useEffect(() => {
    if (loadedPreferences) {
      setPrefs((current) => ({ ...current, ...loadedPreferences }));
    }
  }, [loadedPreferences]);

  const roleLabel = "Student";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function saveSection(section) {
    setSaveState({ section, status: "saving", message: "" });
    try {
      if (useSupabaseData) {
        await savePrefsToBackend(prefs);
      }
      savePreferences(prefs);
      setSaveState({ section, status: "saved", message: "" });
      window.setTimeout(() => setSaveState((current) => current?.section === section ? null : current), 2600);
    } catch (error) {
      setSaveState({
        section,
        status: "error",
        message: "We could not save those settings. Try again."
      });
    }
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
          <AccountSettingsPanel
            user={user}
            profile={profile}
            roleLabel={roleLabel}
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />
          <SectionCard
            title="Academic profile"
            className="dash-panel"
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/profile-stats`} className="dash-btn dash-btn--secondary dash-btn--sm">
                <Pencil className="h-4 w-4" aria-hidden="true" /> Edit full profile
              </Link>
            }
          >
            <p className="dash-muted">Manage GPA, test scores, intended majors, college goals, activities, and essays from your academic profile.</p>
          </SectionCard>
        </>
      ) : null}

      {tab === "notifications" ? (
        <SectionCard title="Email &amp; notifications" className="dash-panel">
          <p className="dash-muted">Choose what Prelude notifies you about. Signed-in accounts sync these preferences to Prelude.</p>
          <SettingToggle id="emailUpdates" label="Product &amp; account emails" description="Important updates about your account." checked={prefs.emailUpdates} onChange={(v) => setPref("emailUpdates", v)} />
          <SettingToggle id="meetingReminders" label="Meeting reminders" description="Reminders before mentor sessions." checked={prefs.meetingReminders} onChange={(v) => setPref("meetingReminders", v)} />
          <SettingToggle id="mentorMessages" label="Mentor message alerts" description="Notify me when my mentor sends a message." checked={prefs.mentorMessages} onChange={(v) => setPref("mentorMessages", v)} />
          <SettingToggle id="studentMessages" label="Student message alerts" description="Notify me when a student or peer message needs attention." checked={prefs.studentMessages} onChange={(v) => setPref("studentMessages", v)} />
          <SettingToggle id="deadlineReminders" label="Deadline reminders" description="Admissions, scholarship, and task deadline reminders." checked={prefs.deadlineReminders} onChange={(v) => setPref("deadlineReminders", v)} />
          <SettingToggle id="progressReminders" label="Progress reminders" description="Light nudges when a planning area has stalled." checked={prefs.progressReminders} onChange={(v) => setPref("progressReminders", v)} />
          <SettingToggle id="rewardUpdates" label="Reward updates" description="Reward unlocks, redemptions, and milestone updates." checked={prefs.rewardUpdates} onChange={(v) => setPref("rewardUpdates", v)} />
          <SettingToggle id="essayComments" label="Essay comments" description="Notes and feedback added to essay drafts." checked={prefs.essayComments} onChange={(v) => setPref("essayComments", v)} />
          <SettingToggle id="collegeApplicationUpdates" label="College application updates" description="Status changes, decisions, and application checklist reminders." checked={prefs.collegeApplicationUpdates} onChange={(v) => setPref("collegeApplicationUpdates", v)} />
          <SettingToggle id="scholarshipReminders" label="Scholarship reminders" description="Scholarship deadlines and result updates." checked={prefs.scholarshipReminders} onChange={(v) => setPref("scholarshipReminders", v)} />
          <SettingToggle id="weeklyDigest" label="Progress digest" description="A summary of deadlines and progress." checked={prefs.weeklyDigest} onChange={(v) => setPref("weeklyDigest", v)} />
          <SettingSelect
            id="digestFrequency"
            label="Digest frequency"
            value={prefs.digestFrequency}
            onChange={(v) => setPref("digestFrequency", v)}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "never", label: "Never" }
            ]}
          />
          <SettingToggle id="productTips" label="Product announcements" description="Occasional admissions tips and Prelude updates." checked={prefs.productTips} onChange={(v) => setPref("productTips", v)} />
          <SettingToggle id="quietHoursEnabled" label="Quiet hours" description="Pause non-urgent notifications during your chosen hours." checked={prefs.quietHoursEnabled} onChange={(v) => setPref("quietHoursEnabled", v)} />
          <div className="dash-setting-row dash-setting-row--stacked">
            <div className="dash-setting-row__text">
              <span className="dash-setting-row__label">Quiet hours window</span>
              <p className="dash-setting-row__desc">Urgent security messages are still delivered.</p>
            </div>
            <div className="dash-setting-row__inline">
              <input className="dash-input" type="time" value={prefs.quietHoursStart} onChange={(e) => setPref("quietHoursStart", e.target.value)} aria-label="Quiet hours start" />
              <span>to</span>
              <input className="dash-input" type="time" value={prefs.quietHoursEnd} onChange={(e) => setPref("quietHoursEnd", e.target.value)} aria-label="Quiet hours end" />
            </div>
          </div>
          <SaveRow section="notifications" saveState={saveState} onSave={saveSection} />
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
          <SaveRow section="calendar" saveState={saveState} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "display" ? (
        <SectionCard title="Display &amp; accessibility" className="dash-panel">
          <SettingSelect
            id="theme"
            label="Theme"
            description="Use system mode unless you prefer a fixed display theme."
            value={prefs.theme}
            onChange={(v) => setPref("theme", v)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" }
            ]}
          />
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
          <SettingToggle
            id="interfaceSounds"
            label="Interface sounds"
            description="Play subtle sounds for clicks, messages, calendar actions, and rewards."
            checked={prefs.interfaceSounds}
            onChange={(v) => setPref("interfaceSounds", v)}
          />
          <SettingToggle
            id="notificationSounds"
            label="Notification sounds"
            description="Play a short sound for live alerts and messages."
            checked={prefs.notificationSounds}
            onChange={(v) => setPref("notificationSounds", v)}
          />
          <SettingToggle
            id="hapticFeedback"
            label="Haptic feedback"
            description="Use subtle vibration on supported mobile devices for confirmations."
            checked={prefs.hapticFeedback}
            onChange={(v) => setPref("hapticFeedback", v)}
          />
          <SaveRow section="display" saveState={saveState} onSave={saveSection} />
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

      {tab === "family" ? <ParentGuardianSettingsPanel user={user} /> : null}

      {tab === "security" ? <SecuritySettingsPanel user={user} onOpenAccount={openAccount} /> : null}

      {tab === "privacy" ? (
        <SectionCard title="Privacy &amp; data" className="dash-panel">
          <SettingSelect
            id="profileVisibility"
            label="Profile visibility"
            description="Control who can see your college-planning profile inside Prelude."
            value={prefs.profileVisibility}
            onChange={(v) => setPref("profileVisibility", v)}
            options={[
              { value: "mentors_only", label: "Assigned mentors only" },
              { value: "parents_and_mentors", label: "Parents and assigned mentors" },
              { value: "private", label: "Private" }
            ]}
          />
          <div className="dash-setting-row">
            <div className="dash-setting-row__text">
              <span className="dash-setting-row__label">Download account data</span>
              <p className="dash-setting-row__desc">
                Request a privacy-safe export of your profile, settings, saved colleges, tasks, essays, scholarships, and activity.
              </p>
              {prefs.dataExportRequestedAt ? (
                <p className="dash-muted">Requested {new Date(prefs.dataExportRequestedAt).toLocaleString()}.</p>
              ) : null}
            </div>
            <SecondaryButton type="button" className="dash-btn--sm" onClick={() => setPref("dataExportRequestedAt", new Date().toISOString())}>
              Request export
            </SecondaryButton>
          </div>
          <p className="dash-muted">
            Account deletion and session revocation stay in Security so they can use the stricter confirmation flow.
          </p>
          <SaveRow section="privacy" saveState={saveState} onSave={saveSection} />
        </SectionCard>
      ) : null}

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
    disconnectZoomAccount,
    saveProfile,
    useSupabaseData,
    profile
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
        <AccountSettingsPanel
          user={user}
          profile={profile}
          roleLabel="Mentor"
          useSupabaseData={useSupabaseData}
          saveProfile={saveProfile}
        />
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

export function ParentSettingsPage() {
  const { user, planDetails, openAccount } = useAuth();
  const {
    integrations,
    connectGoogle,
    disconnectGoogle,
    connectZoomAccount,
    disconnectZoomAccount,
    saveProfile,
    savePreferences: savePrefsToBackend,
    useSupabaseData,
    preferences: loadedPreferences,
    profile
  } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => loadPreferences());
  const [saveState, setSaveState] = useState(null);
  const [linkedChildren, setLinkedChildren] = useState([]);
  const [childrenLoading, setChildrenLoading] = useState(true);

  useEffect(() => {
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (hash && PARENT_SETTINGS_TABS.some((item) => item.id === hash)) {
      setTab(hash);
    }
  }, []);

  useEffect(() => {
    if (loadedPreferences) {
      setPrefs((current) => ({ ...current, ...loadedPreferences }));
    }
  }, [loadedPreferences]);

  useEffect(() => {
    let cancelled = false;
    async function loadChildren() {
      if (!user?.id) {
        setLinkedChildren([]);
        setChildrenLoading(false);
        return;
      }
      setChildrenLoading(true);
      try {
        if (shouldUseDemoFixtures(user)) {
          if (!cancelled) setLinkedChildren(getDemoLinkedChildren());
          return;
        }
        const rows = await listLinkedChildren(user.id);
        if (!cancelled) setLinkedChildren(rows);
      } finally {
        if (!cancelled) setChildrenLoading(false);
      }
    }
    loadChildren();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const roleLabel = "Parent";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  async function saveSection(section) {
    setSaveState({ section, status: "saving", message: "" });
    try {
      if (useSupabaseData) {
        await savePrefsToBackend(prefs);
      }
      savePreferences(prefs);
      setSaveState({ section, status: "saved", message: "" });
      window.setTimeout(() => setSaveState((current) => current?.section === section ? null : current), 2600);
    } catch (error) {
      setSaveState({
        section,
        status: "error",
        message: "We could not save those settings. Try again."
      });
    }
  }

  return (
    <SettingsPageShell
      user={user}
      roleLabel={roleLabel}
      planName={planName}
      tabs={PARENT_SETTINGS_TABS}
      activeTab={tab}
      onTabChange={setTab}
      onOpenAccount={openAccount}
    >
      {tab === "profile" ? (
        <>
          <AccountSettingsPanel
            user={user}
            profile={profile}
            roleLabel={roleLabel}
            useSupabaseData={useSupabaseData}
            saveProfile={saveProfile}
          />

          <SectionCard
            title="Linked children"
            className="dash-panel"
            action={
              <Link to={`${PARENT_DASHBOARD_BASE}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
                <Users className="h-4 w-4" aria-hidden="true" /> View children
              </Link>
            }
          >
            {childrenLoading ? (
              <p className="dash-muted" role="status" aria-live="polite">Loading linked children…</p>
            ) : null}
            {!childrenLoading && !linkedChildren.length ? (
              <p className="dash-muted">
                No children linked yet. Ask your student to add your email during sign-up or invite you from Prelude Settings → Family.
              </p>
            ) : null}
            {!childrenLoading && linkedChildren.length ? (
              <ul className="dash-parent-invite-list">
                {linkedChildren.map((child) => (
                  <li key={child.id} className="dash-parent-invite-list__item">
                    <span>{child.name}</span>
                    <span className="dash-muted">{child.grade || "Student"}</span>
                    <Link
                      to={`${PARENT_DASHBOARD_BASE}/children/${child.id}/overview`}
                      className="dash-btn dash-btn--secondary dash-btn--sm"
                    >
                      Open dashboard
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>
        </>
      ) : null}

      {tab === "notifications" ? (
        <SectionCard title="Email &amp; notifications" className="dash-panel">
          <p className="dash-muted">Choose what Prelude notifies you about as a parent.</p>
          <SettingToggle id="emailUpdates" label="Product &amp; account emails" description="Important updates about your account." checked={prefs.emailUpdates} onChange={(v) => setPref("emailUpdates", v)} />
          <SettingToggle id="meetingReminders" label="Children's meeting reminders" description="Reminders before your children's mentor sessions." checked={prefs.meetingReminders} onChange={(v) => setPref("meetingReminders", v)} />
          <SettingToggle id="interfaceSounds" label="Interface sounds" description="Play subtle sounds for clicks, messages, calendar actions, and rewards." checked={prefs.interfaceSounds} onChange={(v) => setPref("interfaceSounds", v)} />
          <SettingToggle id="notificationSounds" label="In-app notification sounds" description="Play a short sound for live alerts and messages." checked={prefs.notificationSounds} onChange={(v) => setPref("notificationSounds", v)} />
          <SettingToggle id="mentorMessages" label="Mentor message alerts" description="Notify me when a mentor messages me about my children." checked={prefs.mentorMessages} onChange={(v) => setPref("mentorMessages", v)} />
          <SettingToggle id="deadlineReminders" label="Deadline reminders" description="Admissions, scholarship, and task deadline reminders for linked students." checked={prefs.deadlineReminders} onChange={(v) => setPref("deadlineReminders", v)} />
          <SettingToggle id="progressReminders" label="Progress reminders" description="Light nudges when a linked student planning area has stalled." checked={prefs.progressReminders} onChange={(v) => setPref("progressReminders", v)} />
          <SettingToggle id="rewardUpdates" label="Reward updates" description="Reward unlocks, redemptions, and milestone updates for linked students." checked={prefs.rewardUpdates} onChange={(v) => setPref("rewardUpdates", v)} />
          <SettingToggle id="essayComments" label="Essay comments" description="Notes and feedback added to student essay drafts." checked={prefs.essayComments} onChange={(v) => setPref("essayComments", v)} />
          <SettingToggle id="collegeApplicationUpdates" label="College application updates" description="Status changes, decisions, and application checklist reminders." checked={prefs.collegeApplicationUpdates} onChange={(v) => setPref("collegeApplicationUpdates", v)} />
          <SettingToggle id="scholarshipReminders" label="Scholarship reminders" description="Scholarship deadlines and result updates." checked={prefs.scholarshipReminders} onChange={(v) => setPref("scholarshipReminders", v)} />
          <SettingToggle id="weeklyDigest" label="Weekly progress digest" description="A summary of deadlines and progress for your linked children." checked={prefs.weeklyDigest} onChange={(v) => setPref("weeklyDigest", v)} />
          <SettingSelect
            id="digestFrequency"
            label="Digest frequency"
            value={prefs.digestFrequency}
            onChange={(v) => setPref("digestFrequency", v)}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "never", label: "Never" }
            ]}
          />
          <SettingToggle id="productTips" label="Tips for parents" description="Occasional admissions tips and family resources from Prelude." checked={prefs.productTips} onChange={(v) => setPref("productTips", v)} />
          <SettingToggle id="quietHoursEnabled" label="Quiet hours" description="Pause non-urgent notifications during your chosen hours." checked={prefs.quietHoursEnabled} onChange={(v) => setPref("quietHoursEnabled", v)} />
          <div className="dash-setting-row dash-setting-row--stacked">
            <div className="dash-setting-row__text">
              <span className="dash-setting-row__label">Quiet hours window</span>
              <p className="dash-setting-row__desc">Urgent security messages are still delivered.</p>
            </div>
            <div className="dash-setting-row__inline">
              <input className="dash-input" type="time" value={prefs.quietHoursStart} onChange={(e) => setPref("quietHoursStart", e.target.value)} aria-label="Quiet hours start" />
              <span>to</span>
              <input className="dash-input" type="time" value={prefs.quietHoursEnd} onChange={(e) => setPref("quietHoursEnd", e.target.value)} aria-label="Quiet hours end" />
            </div>
          </div>
          <SaveRow section="notifications" saveState={saveState} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "calendar" ? (
        <SectionCard title="Calendar &amp; meeting preferences" className="dash-panel">
          <SettingSelect
            id="defaultCalendarView"
            label="Default calendar view"
            description="The view your calendar opens in when viewing a child."
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
            description="How far ahead to remind you about your children's sessions."
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
          <SaveRow section="calendar" saveState={saveState} onSave={saveSection} />
        </SectionCard>
      ) : null}

      {tab === "display" ? (
        <SectionCard title="Display &amp; accessibility" className="dash-panel">
          <SettingSelect
            id="theme"
            label="Theme"
            description="Use system mode unless you prefer a fixed display theme."
            value={prefs.theme}
            onChange={(v) => setPref("theme", v)}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" }
            ]}
          />
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
          <SettingToggle
            id="interfaceSounds"
            label="Interface sounds"
            description="Play subtle sounds for clicks, messages, calendar actions, and rewards."
            checked={prefs.interfaceSounds}
            onChange={(v) => setPref("interfaceSounds", v)}
          />
          <SettingToggle
            id="hapticFeedback"
            label="Haptic feedback"
            description="Use subtle vibration on supported mobile devices for confirmations."
            checked={prefs.hapticFeedback}
            onChange={(v) => setPref("hapticFeedback", v)}
          />
          <SaveRow section="display" saveState={saveState} onSave={saveSection} />
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
            description="Sync your children's Prelude meetings and deadlines to your Google Calendar."
          />
          <IntegrationConnect
            label="Zoom"
            connectLabel="Connect Zoom Account"
            connected={integrations.zoom?.connected}
            onConnect={connectZoomAccount}
            onDisconnect={disconnectZoomAccount}
            description="Join virtual mentor meetings with your children when mentors share Zoom links."
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
          <Link className="dash-setting-link" to={`${PARENT_DASHBOARD_BASE}/help`}>
            <span>
              <span className="dash-setting-link__label">Help center</span>
              <span className="dash-setting-link__desc">Common questions for parent accounts.</span>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
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

/** @deprecated Use StudentSettingsPage */
export const StudentProfileSettings = StudentSettingsPage;

/** @deprecated Use MentorSettingsPage */
export const MentorProfileSettings = MentorSettingsPage;
