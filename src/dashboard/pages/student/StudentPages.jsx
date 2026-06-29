import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { isJoinableMeeting } from "../../../lib/zoomMeetingLinks.js";
import {
  Award,
  Bot,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  LayoutGrid,
  ListTodo,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  Video,
  X
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useInteractionFeedback } from "../../../components/interaction/InteractionFeedback.jsx";
import { useInterfaceSound } from "../../../lib/sound/SoundProvider.jsx";
import { cn } from "../../../lib/utils.js";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import AdmissionsCalendarVisual from "../../components/product/AdmissionsCalendarVisual.jsx";
import { CalendarAddEventModal } from "../../components/CalendarEventModals.jsx";
import MentorLiveUpdatesSection from "../../components/product/MentorLiveUpdatesSection.jsx";
import PreludeMessagesPage from "../../components/chat/PreludeMessagesPage.jsx";
import PreludeChatPanel from "../../components/PreludeChatPanel.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  Avatar,
  DashBadge,
  DashTabs,
  DeadlineRow,
  EmptyState,
  PrimaryButton,
  ProgressBar,
  SearchInput,
  SecondaryButton,
  SectionCard,
  Modal,
  ViewAllLink
} from "../../components/ui/index.jsx";
import { PRINCETON_REVIEW_MAJORS } from "../../data/princetonReviewMajors.js";
import { collegeById } from "../../data/collegeExploreData.js";
import {
  AchievementPanel,
  ActivityFeed,
  CompactStatCard,
  InsightList,
  MeetingCardPremium,
  MissionCard,
  OverviewHero,
  ProgressRing
} from "../../components/ui/gamification.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";
import CollegesExplore from "../../components/product/CollegesExplore.jsx";
import StudentOverviewProduct from "../../components/product/StudentOverviewProduct.jsx";
import StudentProgressRewardsProduct from "../../components/product/StudentProgressRewardsProduct.jsx";

/* ——— Shared presentational helpers for the redesigned pages ——— */

function EmptyPrompt({ text }) {
  return (
    <p className="dash-empty-prompt">
      <Sparkles className="h-4 w-4" aria-hidden="true" /> {text}
    </p>
  );
}

const MEETING_TYPE_META = {
  zoom: { label: "Zoom", icon: Video },
  google_meet: { label: "Google Meet", icon: Video }
};

const MEETING_STATUS_META = {
  scheduled: { label: "Confirmed", variant: "success" },
  confirmed: { label: "Confirmed", variant: "success" },
  pending: { label: "Pending", variant: "gold" },
  completed: { label: "Completed", variant: "muted" },
  cancelled: { label: "Cancelled", variant: "urgent" },
  canceled: { label: "Cancelled", variant: "urgent" }
};

function formatMeetingDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatMeetingTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function UpcomingMeetingCard({ meeting, mentorName }) {
  const typeMeta = MEETING_TYPE_META[meeting.meetingType] || MEETING_TYPE_META.zoom;
  const statusMeta = MEETING_STATUS_META[meeting.status] || MEETING_STATUS_META.scheduled;
  const TypeIcon = typeMeta.icon;
  return (
    <article className="dash-upcoming-card">
      <div className="dash-upcoming-card__date" aria-hidden="true">
        <span className="dash-upcoming-card__day">{formatMeetingDate(meeting.startTime)}</span>
        <span className="dash-upcoming-card__time">{formatMeetingTime(meeting.startTime)}</span>
      </div>
      <div className="dash-upcoming-card__body">
        <p className="dash-upcoming-card__title">{meeting.title}</p>
        <p className="dash-upcoming-card__meta">
          {mentorName ? `with ${mentorName}` : ""}
        </p>
        <div className="dash-upcoming-card__tags">
          <DashBadge variant="zoom"><TypeIcon className="h-3 w-3" /> {typeMeta.label}</DashBadge>
          <DashBadge variant={statusMeta.variant}>{statusMeta.label}</DashBadge>
        </div>
      </div>
      {isJoinableMeeting(meeting) ? (
        <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--secondary dash-btn--sm">
          <Video className="h-4 w-4" /> Join Meeting
        </a>
      ) : null}
    </article>
  );
}

export function StudentOverview() {
  return <StudentOverviewProduct />;
}

export function StudentProgressRewards() {
  return <StudentProgressRewardsProduct />;
}

export function StudentCalendar() {
  const { meetings, events, mentor, deadlines, isMentorStudentView } = useDashboardData();
  const [upcomingEventsMountEl, setUpcomingEventsMountEl] = useState(null);

  return (
    <div className={cn("dash-page", "dash-page--meetings", isMentorStudentView && "dash-page--mentor-view")}>
      <div className={cn("dash-meetings-layout", isMentorStudentView && "dash-meetings-layout--mentor-view")}>
        <div className="dash-meetings-layout__calendar">
          <AdmissionsCalendarVisual
            deadlines={deadlines}
            meetings={meetings}
            events={events}
            mentorName={mentor?.name}
            showUpcomingEvents
            upcomingEventsPlacement="external"
            upcomingEventsMountEl={upcomingEventsMountEl}
          />
        </div>
        <aside className={cn("dash-meetings-layout__side", isMentorStudentView && "dash-mentor-view-readonly")}>
          <MentorLiveUpdatesSection />
          <div ref={setUpcomingEventsMountEl} className="dash-meetings-layout__upcoming" />
        </aside>
      </div>
    </div>
  );
}

export function StudentAI() {
  return (
    <div className="dash-page dash-page--flush">
      <PreludeChatPanel />
    </div>
  );
}

const GPA_SCALE_OPTIONS = ["/4.00", "/5.00"];
const GRADE_LEVEL_OPTIONS = ["9th grade", "10th grade", "11th grade", "12th grade", "Gap year"];
const PROFILE_EDITOR_SECTIONS = [
  { id: "academic", title: "Academic Profile" },
  { id: "activities", title: "Extracurricular Activities" },
  { id: "awards", title: "Awards and Honors" },
  { id: "leadership", title: "Leadership" },
  { id: "volunteer", title: "Volunteer Experience" },
  { id: "work", title: "Work Experience" }
];

const SIMPLE_ENTRY_FIELDS = {
  awards: [
    { key: "name", label: "Award name" },
    { key: "organization", label: "Organization" },
    { key: "grade", label: "Grade received" },
    { key: "description", label: "Description", textarea: true }
  ],
  leadership: [
    { key: "name", label: "Leadership position" },
    { key: "organization", label: "Organization" },
    { key: "grade", label: "Grade(s)" },
    { key: "description", label: "Description", textarea: true }
  ]
};

const BLANK_ENTRY = {
  activities: { name: "", role: "", startDate: "", endDate: "", present: false, weeklyHours: "", description: "" },
  awards: { name: "", organization: "", grade: "", description: "" },
  leadership: { name: "", organization: "", grade: "", description: "" },
  volunteer: { name: "", organization: "", startDate: "", endDate: "", present: false, description: "" },
  work: { name: "", organization: "", role: "", startDate: "", endDate: "", present: false, description: "" }
};

function createBlankEntry(sectionId) {
  return { ...(BLANK_ENTRY[sectionId] || { name: "" }) };
}

function parseOptionalNumber(value) {
  if (value === "" || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseOptionalString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeSectionEntry(sectionId, entry) {
  return {
    ...createBlankEntry(sectionId),
    ...(entry || {}),
    present: Boolean(entry?.present)
  };
}

function normalizeSectionEntries(sectionId, entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeSectionEntry(sectionId, entry))
    .filter(hasEntryContent);
}

function loadSectionEntries(sectionId, prefs, entriesKey, legacyKey, legacyFallback) {
  const stored = prefs?.[entriesKey];
  if (Array.isArray(stored)) {
    return stored.map((entry) => normalizeSectionEntry(sectionId, entry));
  }
  if (Array.isArray(legacyFallback)) {
    return legacyFallback.map((entry) => normalizeSectionEntry(sectionId, entry));
  }
  const legacy = prefs?.[legacyKey] || legacyFallback || "";
  return entriesFromLegacy(legacy).map((entry) => normalizeSectionEntry(sectionId, entry));
}

function sectionEntriesSource(profile, sectionId) {
  const prefs = profile?.mentorPreferences || {};
  const map = {
    activities: profile?.extracurricularActivities ?? prefs.extracurricularEntries,
    awards: profile?.awards ?? prefs.awardsEntries,
    leadership: profile?.leadership ?? prefs.leadershipEntries,
    volunteer: profile?.volunteerExperience ?? prefs.volunteerEntries,
    work: profile?.workExperience ?? prefs.workEntries
  };
  const raw = map[sectionId];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return entriesFromLegacy(raw);
  return [];
}

function profileEntriesBySection(profile, sectionId) {
  return normalizeSectionEntries(sectionId, sectionEntriesSource(profile, sectionId));
}

function hasProfileValue(value) {
  return value != null && value !== "";
}

function formatDateRange(entry) {
  if (!entry?.startDate && !entry?.endDate && !entry?.present) return "";
  const start = entry.startDate || "—";
  const end = entry.present ? "Present" : (entry.endDate || "—");
  return `${start} – ${end}`;
}

function formatYearFromMonth(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4})/);
  return match ? match[1] : String(value);
}

function formatDateRangeDisplay(entry) {
  if (!entry?.startDate && !entry?.endDate && !entry?.present) return "";
  const start = formatYearFromMonth(entry.startDate);
  const end = entry.present ? "Present" : formatYearFromMonth(entry.endDate);
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  return start || end;
}

function formatActivityDateRange(entry) {
  if (!entry?.startDate && !entry?.endDate && !entry?.present) return "";
  const start = String(entry.startDate ?? "").trim();
  const end = entry.present ? "Present" : String(entry.endDate ?? "").trim();
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

function activityEntryPreviewLine(entry) {
  const parts = [
    String(entry?.name ?? "").trim(),
    String(entry?.role ?? "").trim(),
    formatActivityDateRange(entry)
  ].filter(Boolean);
  return parts.join(" · ");
}

function hasEntryContent(entry) {
  if (!entry || typeof entry !== "object") return false;
  return Object.entries(entry).some(([key, value]) => {
    if (key === "present") return Boolean(value);
    return value != null && String(value).trim() !== "";
  });
}

function sectionEntrySummaryLine(sectionId, entry) {
  if (sectionId === "activities") {
    return activityEntryPreviewLine(entry);
  }
  if (sectionId === "work") {
    const parts = [entry.name, entry.role, formatDateRangeDisplay(entry)].filter(Boolean);
    return parts.join(" | ");
  }
  if (sectionId === "volunteer") {
    const parts = [entry.name];
    if (entry.hours) parts.push(`${entry.hours} hours`);
    else {
      const dates = formatDateRangeDisplay(entry);
      if (dates) parts.push(dates);
      else if (entry.organization) parts.push(entry.organization);
    }
    return parts.filter(Boolean).join(" | ");
  }
  if (sectionId === "awards") {
    return [entry.name, entry.grade].filter(Boolean).join(" | ");
  }
  if (sectionId === "leadership") {
    return [entry.name, entry.grade || entry.organization].filter(Boolean).join(" | ");
  }
  return entry.name || entry.role || entry.organization || "";
}

function entryPreviewText(sectionId, entry) {
  if (sectionId === "activities") {
    return activityEntryPreviewLine(entry);
  }
  const title = entry.name || entry.role || entry.organization || "Untitled";
  if (sectionId === "work" || sectionId === "volunteer") {
    const parts = [title];
    if (entry.organization) parts.push(entry.organization);
    const dates = formatDateRange(entry);
    if (dates) parts.push(dates);
    return parts.join(" · ");
  }
  const parts = [title];
  if (entry.organization) parts.push(entry.organization);
  if (entry.grade) parts.push(`Grade ${entry.grade}`);
  return parts.join(" · ");
}

function sanitizeNumericInput(value, { allowDecimal = false, maxDecimals = 2 } = {}) {
  let next = String(value ?? "");
  if (allowDecimal) {
    next = next.replace(/[^\d.]/g, "");
    const [whole = "", ...rest] = next.split(".");
    if (rest.length) {
      next = `${whole}.${rest.join("").slice(0, maxDecimals)}`;
    } else {
      next = whole;
    }
  } else {
    next = next.replace(/\D/g, "");
  }
  return next;
}

function blockInvalidNumericKeys(event, { allowDecimal = false } = {}) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
  if (allowed.includes(event.key)) return;
  if (allowDecimal && event.key === "." && !String(event.currentTarget.value).includes(".")) return;
  if (/^\d$/.test(event.key)) return;
  event.preventDefault();
}

function NumericInput({ value, onChange, allowDecimal = false, maxDecimals = 2, className, ...props }) {
  return (
    <input
      type="text"
      inputMode={allowDecimal ? "decimal" : "numeric"}
      autoComplete="off"
      className={className}
      value={value ?? ""}
      onChange={(event) => onChange(sanitizeNumericInput(event.target.value, { allowDecimal, maxDecimals }))}
      onKeyDown={(event) => blockInvalidNumericKeys(event, { allowDecimal })}
      onPaste={(event) => {
        event.preventDefault();
        const pasted = event.clipboardData.getData("text");
        onChange(sanitizeNumericInput(pasted, { allowDecimal, maxDecimals }));
      }}
      {...props}
    />
  );
}

function academicSummaryLine(academic) {
  const parts = [];
  if (academic.gradeLevel) parts.push(academic.gradeLevel);
  if (academic.graduationYear) parts.push(`Graduation ${academic.graduationYear}`);
  if (academic.gpa != null && academic.gpa !== "") parts.push(`GPA ${formatGpa(academic.gpa, academic.gpaScale)}`);
  if (academic.weightedGpa != null && academic.weightedGpa !== "") parts.push(`Weighted GPA ${academic.weightedGpa}`);
  if (academic.sat != null && academic.sat !== "") parts.push(`SAT ${academic.sat}`);
  if (academic.act != null && academic.act !== "") parts.push(`ACT ${academic.act}`);
  return parts.length ? parts.join(" | ") : "No academic details yet.";
}

function DateRangeWithPresent({ entry, onFieldChange, presentLabel }) {
  return (
    <div className="dash-profile-date-range dash-profile-modal-grid__full">
      <label className="prelude-field">
        <span>Start date</span>
        <input type="month" value={entry.startDate ?? ""} onChange={(e) => onFieldChange("startDate", e.target.value)} />
      </label>
      {entry.present ? (
        <label className="prelude-field">
          <span>End date</span>
          <input type="text" value="Present" readOnly disabled className="dash-profile-present-display" />
        </label>
      ) : (
        <label className="prelude-field">
          <span>End date</span>
          <input type="month" value={entry.endDate ?? ""} onChange={(e) => onFieldChange("endDate", e.target.value)} />
        </label>
      )}
      <label className="prelude-field dash-profile-present-check">
        <span>{presentLabel}</span>
        <input
          type="checkbox"
          checked={Boolean(entry.present)}
          onChange={(e) => {
            onFieldChange("present", e.target.checked);
            if (e.target.checked) onFieldChange("endDate", "");
          }}
        />
      </label>
    </div>
  );
}

function ProfileExpandedEntryForm({ sectionId, entry, onFieldChange }) {
  if (sectionId === "activities") {
    return (
      <div className="dash-profile-modal-grid">
        <label className="prelude-field"><span>Activity name</span><input value={entry.name ?? ""} onChange={(e) => onFieldChange("name", e.target.value)} /></label>
        <label className="prelude-field"><span>Position/Role</span><input value={entry.role ?? ""} onChange={(e) => onFieldChange("role", e.target.value)} /></label>
        <DateRangeWithPresent entry={entry} onFieldChange={onFieldChange} presentLabel="Still participating" />
        <label className="prelude-field"><span>Weekly hours</span><NumericInput value={entry.weeklyHours ?? ""} onChange={(value) => onFieldChange("weeklyHours", value)} /></label>
        <label className="prelude-field dash-profile-modal-grid__full">
          <span>Description</span>
          <textarea className="dash-profile-desc-textarea" rows={3} value={entry.description ?? ""} onChange={(e) => onFieldChange("description", e.target.value)} />
        </label>
      </div>
    );
  }

  if (sectionId === "work") {
    return (
      <div className="dash-profile-modal-grid">
        <label className="prelude-field"><span>Job/Internship</span><input value={entry.name ?? ""} onChange={(e) => onFieldChange("name", e.target.value)} /></label>
        <label className="prelude-field"><span>Company/Organization</span><input value={entry.organization ?? ""} onChange={(e) => onFieldChange("organization", e.target.value)} /></label>
        <label className="prelude-field"><span>Role</span><input value={entry.role ?? ""} onChange={(e) => onFieldChange("role", e.target.value)} /></label>
        <DateRangeWithPresent entry={entry} onFieldChange={onFieldChange} presentLabel="Still working here" />
        <label className="prelude-field dash-profile-modal-grid__full">
          <span>Description</span>
          <textarea className="dash-profile-desc-textarea" rows={3} value={entry.description ?? ""} onChange={(e) => onFieldChange("description", e.target.value)} />
        </label>
      </div>
    );
  }

  if (sectionId === "volunteer") {
    return (
      <div className="dash-profile-modal-grid">
        <label className="prelude-field"><span>Experience name</span><input value={entry.name ?? ""} onChange={(e) => onFieldChange("name", e.target.value)} /></label>
        <label className="prelude-field"><span>Organization</span><input value={entry.organization ?? ""} onChange={(e) => onFieldChange("organization", e.target.value)} /></label>
        <DateRangeWithPresent entry={entry} onFieldChange={onFieldChange} presentLabel="Present" />
        <label className="prelude-field dash-profile-modal-grid__full">
          <span>Description</span>
          <textarea className="dash-profile-desc-textarea" rows={3} value={entry.description ?? ""} onChange={(e) => onFieldChange("description", e.target.value)} />
        </label>
      </div>
    );
  }

  const fields = SIMPLE_ENTRY_FIELDS[sectionId] || [];
  return (
    <div className="dash-profile-modal-grid">
      {fields.map((field) => (
        <label key={field.key} className={cn("prelude-field", field.textarea && "dash-profile-modal-grid__full")}>
          <span>{field.label}</span>
          {field.textarea ? (
            <textarea className="dash-profile-desc-textarea" rows={3} value={entry[field.key] ?? ""} onChange={(e) => onFieldChange(field.key, e.target.value)} />
          ) : (
            <input type={field.type || "text"} value={entry[field.key] ?? ""} onChange={(e) => onFieldChange(field.key, e.target.value)} />
          )}
        </label>
      ))}
    </div>
  );
}

function parseCommaList(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function entriesFromLegacy(text) {
  if (!text) return [];
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ name: line }));
}

function entriesToLegacy(entries) {
  return (entries || [])
    .map((entry) => entry.name || entry.role || entry.organization || "")
    .filter(Boolean)
    .join("\n");
}

function buildProfileEditorDraft(profile) {
  const prefs = profile?.mentorPreferences || {};
  return {
    academic: {
      gradeLevel: profile?.grade ?? "",
      graduationYear: profile?.graduationYear ?? "",
      gpa: profile?.gpa ?? "",
      gpaScale: profile?.gpaScale ?? prefs.gpaScale ?? "/4.00",
      weightedGpa: profile?.weightedGpa ?? "",
      sat: profile?.sat ?? "",
      act: profile?.act ?? prefs.act ?? ""
    },
    majors: [...(profile?.majors || [])],
    preferences: {
      preferredColleges: (profile?.colleges || []).join(", "),
      locationPreferences: profile?.locationPreferences ?? prefs.location ?? "",
      collegeSizePreferences: profile?.collegeSizePreferences ?? prefs.size ?? "",
      financialAidNotes: profile?.financialAidNotes ?? prefs.budget ?? ""
    },
    activities: loadSectionEntries("activities", prefs, "extracurricularEntries", "activities", profile?.extracurricularActivities || profile?.activities),
    awards: loadSectionEntries("awards", prefs, "awardsEntries", "awards", profile?.awards),
    leadership: loadSectionEntries("leadership", prefs, "leadershipEntries", "leadershipRoles", profile?.leadership || profile?.leadershipRoles),
    volunteer: loadSectionEntries("volunteer", prefs, "volunteerEntries", "volunteerWork", profile?.volunteerExperience || profile?.volunteerWork),
    work: loadSectionEntries("work", prefs, "workEntries", "workExperience", profile?.workExperience)
  };
}

function profileFieldsFromDraft(draft, existingProfile) {
  const gpaScale = GPA_SCALE_OPTIONS.includes(draft.academic.gpaScale) ? draft.academic.gpaScale : "/4.00";
  const preferredColleges = parseCommaList(draft.preferences?.preferredColleges);
  const activities = normalizeSectionEntries("activities", draft.activities);
  const awards = normalizeSectionEntries("awards", draft.awards);
  const leadership = normalizeSectionEntries("leadership", draft.leadership);
  const volunteer = normalizeSectionEntries("volunteer", draft.volunteer);
  const work = normalizeSectionEntries("work", draft.work);
  const act = parseOptionalNumber(draft.academic.act);
  const mentorPreferences = {
    location: draft.preferences?.locationPreferences || existingProfile?.mentorPreferences?.location || "",
    size: draft.preferences?.collegeSizePreferences || existingProfile?.mentorPreferences?.size || "",
    budget: draft.preferences?.financialAidNotes || existingProfile?.mentorPreferences?.budget || "",
    gpaScale,
    act,
    extracurricularEntries: activities,
    awardsEntries: awards,
    leadershipEntries: leadership,
    volunteerEntries: volunteer,
    workEntries: work,
    activities: entriesToLegacy(activities),
    awards: entriesToLegacy(awards),
    leadershipRoles: entriesToLegacy(leadership),
    volunteerWork: entriesToLegacy(volunteer),
    workExperience: entriesToLegacy(work)
  };

  return {
    gradeLevel: parseOptionalString(draft.academic.gradeLevel),
    graduationYear: parseOptionalNumber(draft.academic.graduationYear),
    gpa: parseOptionalNumber(draft.academic.gpa),
    gpaScale,
    weightedGpa: parseOptionalNumber(draft.academic.weightedGpa),
    sat: parseOptionalNumber(draft.academic.sat),
    act,
    targetMajors: Array.isArray(draft.majors) ? draft.majors : (existingProfile?.majors || []),
    collegeInterests: preferredColleges.length ? preferredColleges : (existingProfile?.colleges || []),
    extracurricularActivities: activities,
    awards,
    leadership,
    volunteerExperience: volunteer,
    workExperience: work,
    academicGoals: entriesToLegacy(activities) || null,
    bio: entriesToLegacy(leadership) || null,
    mentorPreferences
  };
}

function formatGpa(gpa, scale = "/4.00") {
  if (!hasProfileValue(gpa)) return null;
  return `${gpa}${scale}`;
}

function profileDisplayValue(value) {
  return hasProfileValue(value) ? value : null;
}

function computeLocalProfileCompletion(profile) {
  const checks = [profile?.grade, profile?.graduationYear, profile?.gpa, profile?.sat, profile?.majors?.length, profile?.colleges?.length];
  const filled = checks.filter((v) => v != null && v !== "" && v !== 0).length;
  return Math.round((filled / checks.length) * 100);
}

export function StudentProfileStats() {
  const { user } = useAuth();
  const { profile, mentor, saveProfile, saveOnboarding, savedColleges } = useDashboardData();
  const [editorDraft, setEditorDraft] = useState(() => buildProfileEditorDraft(profile));
  const [activeEditor, setActiveEditor] = useState(null);
  const [modalDraft, setModalDraft] = useState(null);
  const [expandedEntryIndex, setExpandedEntryIndex] = useState(null);
  const [majorsEditorOpen, setMajorsEditorOpen] = useState(false);
  const [majorsDraft, setMajorsDraft] = useState([]);
  const [majorSearchQuery, setMajorSearchQuery] = useState("");
  const [completion, setCompletion] = useState(profile?.profileCompletion ?? computeLocalProfileCompletion(profile));
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const majors = editorDraft.majors || [];

  useEffect(() => {
    setEditorDraft(buildProfileEditorDraft(profile));
    setCompletion(profile?.profileCompletion ?? computeLocalProfileCompletion(profile));
  }, [profile]);

  async function persistDraft(nextDraft) {
    setSaving(true);
    setError("");
    try {
      const fields = profileFieldsFromDraft(nextDraft, profile);
      await saveProfile(fields);
      const nextCompletion = computeLocalProfileCompletion({
        grade: fields.gradeLevel,
        graduationYear: fields.graduationYear,
        gpa: fields.gpa,
        sat: fields.sat,
        majors: fields.targetMajors,
        colleges: fields.collegeInterests
      });
      setCompletion(nextCompletion);
      try {
        await saveOnboarding({ profileComplete: nextCompletion });
      } catch (onboardingErr) {
        setError(onboardingErr.message || "Profile saved, but progress tracking failed.");
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
      return true;
    } catch (err) {
      setError(err.message || "Could not save profile. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function sectionSummary(sectionId) {
    if (sectionId === "academic") {
      return academicSummaryLine(editorDraft.academic);
    }
    const entries = profileEntriesBySection(profile, sectionId);
    if (!entries.length) return "No entries yet.";
    return sectionEntrySummaryLine(sectionId, entries[0]) || "No entries yet.";
  }

  function sectionPreviewData(sectionId) {
    if (sectionId === "academic") return null;
    const entries = profileEntriesBySection(profile, sectionId);
    if (!entries.length) return null;
    const bullets = entries
      .slice(0, 3)
      .map((entry) => sectionEntrySummaryLine(sectionId, entry))
      .filter(Boolean);
    if (!bullets.length) return null;
    return {
      bullets,
      moreCount: Math.max(entries.length - bullets.length, 0)
    };
  }

  function loadSectionEditorEntries(sectionId) {
    const fromProfile = profileEntriesBySection(profile, sectionId);
    if (fromProfile.length) {
      return fromProfile.map((entry) => normalizeSectionEntry(sectionId, entry));
    }
    return normalizeSectionEntries(sectionId, editorDraft[sectionId] || []);
  }

  function openSectionEditor(sectionId) {
    setActiveEditor(sectionId);
    if (sectionId === "academic") {
      setModalDraft({ ...editorDraft.academic });
      setExpandedEntryIndex(null);
    } else {
      const entries = loadSectionEditorEntries(sectionId);
      if (entries.length === 0) {
        setModalDraft([createBlankEntry(sectionId)]);
        setExpandedEntryIndex(0);
      } else {
        setModalDraft(entries);
        setExpandedEntryIndex(null);
      }
    }
  }

  function closeSectionEditor() {
    if (saving) return;
    setActiveEditor(null);
    setModalDraft(null);
    setExpandedEntryIndex(null);
  }

  async function saveSectionEditor() {
    if (!activeEditor) return;
    const nextDraft = activeEditor === "academic"
      ? {
          ...editorDraft,
          academic: { ...modalDraft }
        }
      : {
          ...editorDraft,
          [activeEditor]: normalizeSectionEntries(activeEditor, modalDraft)
        };
    const ok = await persistDraft(nextDraft);
    if (!ok) return;
    setEditorDraft(nextDraft);
    closeSectionEditor();
  }

  function updateAcademicField(key, value) {
    setModalDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateEntry(index, key, value) {
    setModalDraft((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    );
  }

  function addEntry(sectionId) {
    setModalDraft((prev) => {
      const entries = prev || [];
      const nextIndex = entries.length;
      setExpandedEntryIndex(nextIndex);
      return [...entries, createBlankEntry(sectionId)];
    });
  }

  function removeEntry(index) {
    setModalDraft((prev) => prev.filter((_, i) => i !== index));
    setExpandedEntryIndex((current) => {
      if (current === index) return null;
      if (current != null && current > index) return current - 1;
      return current;
    });
  }

  function expandEntry(index) {
    setExpandedEntryIndex(index);
  }

  function openMajorsEditor() {
    setMajorsDraft([...(editorDraft.majors || [])]);
    setMajorSearchQuery("");
    setMajorsEditorOpen(true);
  }

  function closeMajorsEditor() {
    if (saving) return;
    setMajorsEditorOpen(false);
    setMajorsDraft([]);
    setMajorSearchQuery("");
  }

  function toggleMajorSelection(major) {
    setMajorsDraft((current) => (
      current.includes(major) ? current.filter((item) => item !== major) : [...current, major]
    ));
  }

  function removeMajorSelection(major) {
    setMajorsDraft((current) => current.filter((item) => item !== major));
  }

  async function saveMajorsEditor() {
    const nextDraft = { ...editorDraft, majors: [...majorsDraft] };
    const ok = await persistDraft(nextDraft);
    if (!ok) return;
    setEditorDraft(nextDraft);
    closeMajorsEditor();
  }

  const filteredMajors = PRINCETON_REVIEW_MAJORS.filter((major) => {
    if (!majorSearchQuery.trim()) return true;
    return major.toLowerCase().includes(majorSearchQuery.trim().toLowerCase());
  });

  return (
    <div className="dash-page dash-page--premium">
      <SectionCard className="dash-profile-hero dash-panel" padding={false}>
        <div className="dash-profile-hero__inner">
          <Avatar name={user?.name} size="lg" />
          <div className="dash-profile-hero__id">
            <h2 className="dash-profile-hero__name">{user?.name || "Your name"}</h2>
            <p className="dash-profile-hero__email"><Mail className="h-4 w-4" /> {user?.email || "Add your email"}</p>
            <div className="dash-profile-hero__badges">
              <DashBadge variant="soft">{roleLabel}</DashBadge>
              {hasProfileValue(profile?.grade) ? <DashBadge variant="lavender">{profile.grade}</DashBadge> : null}
              {(mentor?.name || profile?.mentorName) ? (
                <DashBadge variant="lavender"><GraduationCap className="h-3 w-3" /> {mentor?.name || profile?.mentorName}</DashBadge>
              ) : null}
            </div>
          </div>
          <div className="dash-profile-hero__completion">
            <ProgressRing value={completion} size={76} />
            <div className="dash-profile-hero__completion-text">
              <p className="dash-profile-hero__completion-label">Profile completion</p>
              <a href="#profile-edit" className="dash-btn dash-btn--primary dash-btn--sm">
                <Pencil className="h-4 w-4" /> Edit profile
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      {completion < 100 ? (
        <div className="dash-callout">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <p>You're {completion}% complete. Fill in the remaining sections so your mentor and Prelude AI can give sharper recommendations.</p>
        </div>
      ) : null}

      <div className="dash-metric-row">
        {hasProfileValue(profile?.grade) ? (
          <CompactStatCard icon={GraduationCap} label="Grade" value={profile.grade} />
        ) : null}
        {hasProfileValue(profile?.graduationYear) ? (
          <CompactStatCard icon={CalendarDays} label="Graduation Year" value={String(profile.graduationYear)} />
        ) : null}
        {formatGpa(profile?.gpa, profile?.gpaScale) ? (
          <CompactStatCard icon={Target} label="GPA" value={formatGpa(profile?.gpa, profile?.gpaScale)} />
        ) : null}
        {hasProfileValue(profile?.sat) ? (
          <CompactStatCard icon={Award} label="SAT" value={String(profile.sat)} />
        ) : null}
      </div>

      <div className="dash-overview-grid dash-overview-grid--premium">
        <div className="dash-overview-grid__col">
          <SectionCard
            title="Intended majors"
            className="dash-panel"
            action={(
              <SecondaryButton type="button" className="dash-btn--sm" onClick={openMajorsEditor}>
                <Pencil className="h-4 w-4" /> Edit Majors
              </SecondaryButton>
            )}
          >
            {majors.length ? (
              <div className="dash-tags">{majors.map((mj) => <DashBadge key={mj} variant="lavender">{mj}</DashBadge>)}</div>
            ) : (
              <EmptyPrompt text="Add the majors you're considering so your mentor can tailor school suggestions." />
            )}
          </SectionCard>

          <SectionCard
            title="Colleges Saved"
            className="dash-panel"
            action={(
              <SecondaryButton
                as={Link}
                to={`${STUDENT_DASHBOARD_BASE}/workspace`}
                state={{ workspaceTab: "colleges" }}
                className="dash-btn--sm"
              >
                View Colleges
              </SecondaryButton>
            )}
          >
            {(savedColleges || []).length ? (
              <ul className="dash-goal-list">
                {(savedColleges || []).map((entry) => {
                  const school = collegeById(entry.collegeId);
                  if (!school) return null;
                  const label = school.shortName || school.name;
                  return (
                    <li key={entry.collegeId}><span className="dash-goal-list__dot" aria-hidden="true">•</span> {label}</li>
                  );
                })}
              </ul>
            ) : (
              <EmptyPrompt text="Add target colleges to start building a balanced list." />
            )}
          </SectionCard>
        </div>

        <div className="dash-overview-grid__col">
          <SectionCard title="Academic snapshot" className="dash-panel">
            <dl className="dash-kv">
              {hasProfileValue(profile?.grade) ? <div><dt>Grade</dt><dd>{profile.grade}</dd></div> : null}
              {hasProfileValue(profile?.graduationYear) ? <div><dt>Graduation</dt><dd>{profile.graduationYear}</dd></div> : null}
              {formatGpa(profile?.gpa, profile?.gpaScale) ? <div><dt>GPA</dt><dd>{formatGpa(profile?.gpa, profile?.gpaScale)}</dd></div> : null}
              {hasProfileValue(profile?.weightedGpa) ? <div><dt>Weighted GPA</dt><dd>{profile.weightedGpa}</dd></div> : null}
              {hasProfileValue(profile?.sat) ? <div><dt>SAT</dt><dd>{profile.sat}</dd></div> : null}
              {hasProfileValue(profile?.act) ? <div><dt>ACT</dt><dd>{profile.act}</dd></div> : null}
              {hasProfileValue(mentor?.name || profile?.mentorName) ? (
                <div><dt>Mentor</dt><dd>{mentor?.name || profile?.mentorName}</dd></div>
              ) : null}
            </dl>
            {!hasProfileValue(profile?.grade)
              && !hasProfileValue(profile?.graduationYear)
              && !formatGpa(profile?.gpa, profile?.gpaScale)
              && !hasProfileValue(profile?.weightedGpa)
              && !hasProfileValue(profile?.sat)
              && !hasProfileValue(profile?.act)
              && !hasProfileValue(mentor?.name || profile?.mentorName) ? (
                <EmptyPrompt text="Add academic details to see your snapshot here." />
            ) : null}
          </SectionCard>
        </div>
      </div>

      <div id="profile-edit" className="dash-profile-form">
        <div className="dash-section-heading">
          <h2 className="dash-section-heading__title">Edit Profile Details</h2>
          <p className="dash-muted">Open each section to edit in a focused panel.</p>
        </div>

        <SectionCard className="dash-panel dash-profile-unified">
          <div className="dash-profile-unified__sections">
            {PROFILE_EDITOR_SECTIONS.map((section) => (
              <article key={section.id} className="dash-profile-summary-card">
                <div className="dash-profile-summary-card__main">
                  <h3 className="dash-profile-summary-card__title">{section.title}</h3>
                  {section.id === "academic" ? (
                    <p className="dash-profile-summary-card__preview dash-profile-summary-card__preview--wrap">
                      {sectionSummary(section.id)}
                    </p>
                  ) : (() => {
                    const preview = sectionPreviewData(section.id);
                    if (!preview) {
                      return <p className="dash-profile-summary-card__preview dash-profile-summary-card__preview--wrap">No entries yet.</p>;
                    }
                    return (
                      <div className="dash-profile-summary-card__list-wrap">
                        <ul className="dash-profile-summary-card__list">
                          {preview.bullets.map((line, idx) => (
                            <li key={`${section.id}-${idx}`}>{line}</li>
                          ))}
                        </ul>
                        {preview.moreCount > 0 ? (
                          <p className="dash-profile-summary-card__more">+ {preview.moreCount} more</p>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <SecondaryButton
                  type="button"
                  className="dash-btn--sm dash-profile-summary-card__edit"
                  onClick={() => openSectionEditor(section.id)}
                >
                  Edit
                </SecondaryButton>
              </article>
            ))}
          </div>
        </SectionCard>

        <div className="dash-form-actions">
          {error ? <span className="dash-save-state dash-save-state--error">{error}</span> : null}
          {saved ? (
            <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Profile saved</span>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(activeEditor)}
        onClose={closeSectionEditor}
        scrollable
        className="dash-modal--profile"
        title={PROFILE_EDITOR_SECTIONS.find((section) => section.id === activeEditor)?.title || "Edit section"}
        footer={(
          <>
            <SecondaryButton type="button" onClick={closeSectionEditor} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton type="button" onClick={saveSectionEditor} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </PrimaryButton>
          </>
        )}
      >
        {activeEditor === "academic" ? (
          <div className="dash-profile-modal-grid dash-profile-modal-grid--academic">
            <label className="prelude-field">
              <span>Grade level</span>
              <select value={modalDraft?.gradeLevel ?? ""} onChange={(e) => updateAcademicField("gradeLevel", e.target.value)}>
                <option value="">Select grade</option>
                {GRADE_LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="prelude-field"><span>Graduation year</span><NumericInput value={modalDraft?.graduationYear ?? ""} onChange={(value) => updateAcademicField("graduationYear", value)} /></label>
            <label className="prelude-field"><span>GPA</span><NumericInput allowDecimal value={modalDraft?.gpa ?? ""} onChange={(value) => updateAcademicField("gpa", value)} /></label>
            <label className="prelude-field">
              <span>GPA scale</span>
              <select value={modalDraft?.gpaScale ?? "/4.00"} onChange={(e) => updateAcademicField("gpaScale", e.target.value)}>
                {GPA_SCALE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="prelude-field"><span>Weighted GPA</span><NumericInput allowDecimal value={modalDraft?.weightedGpa ?? ""} onChange={(value) => updateAcademicField("weightedGpa", value)} /></label>
            <label className="prelude-field"><span>SAT score</span><NumericInput value={modalDraft?.sat ?? ""} onChange={(value) => updateAcademicField("sat", value)} /></label>
            <label className="prelude-field"><span>ACT score</span><NumericInput value={modalDraft?.act ?? ""} onChange={(value) => updateAcademicField("act", value)} /></label>
          </div>
        ) : null}

        {activeEditor && activeEditor !== "academic" ? (
          <div className="dash-profile-entry-editor">
            {(modalDraft || []).map((entry, index) => {
              const sectionTitle = PROFILE_EDITOR_SECTIONS.find((section) => section.id === activeEditor)?.title;
              const isExpanded = expandedEntryIndex === index;

              if (!isExpanded) {
                return (
                  <div key={`${activeEditor}-${index}`} className="dash-profile-entry-row">
                    <p className="dash-profile-entry-row__preview">{entryPreviewText(activeEditor, entry)}</p>
                    <div className="dash-profile-entry-row__actions">
                      <SecondaryButton type="button" className="dash-btn--sm" onClick={() => expandEntry(index)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </SecondaryButton>
                      <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={() => removeEntry(index)}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <section key={`${activeEditor}-${index}`} className="dash-profile-entry-card dash-profile-entry-card--expanded">
                  <div className="dash-profile-entry-card__head">
                    <strong>{sectionTitle} #{index + 1}</strong>
                    <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={() => removeEntry(index)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                  <ProfileExpandedEntryForm
                    sectionId={activeEditor}
                    entry={entry}
                    onFieldChange={(key, value) => updateEntry(index, key, value)}
                  />
                </section>
              );
            })}
            <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={() => addEntry(activeEditor)}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={majorsEditorOpen}
        onClose={closeMajorsEditor}
        scrollable
        className="dash-modal--profile dash-modal--majors"
        title="Edit Intended Majors"
        footer={(
          <>
            <SecondaryButton type="button" onClick={closeMajorsEditor} disabled={saving}>Cancel</SecondaryButton>
            <PrimaryButton type="button" onClick={saveMajorsEditor} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </PrimaryButton>
          </>
        )}
      >
        <div className="dash-profile-majors-editor">
          {majorsDraft.length ? (
            <div className="dash-profile-majors-editor__selected">
              <p className="dash-profile-majors-editor__label">Selected majors</p>
              <div className="dash-tags">
                {majorsDraft.map((major) => (
                  <button
                    key={major}
                    type="button"
                    className="dash-profile-majors-editor__pill"
                    onClick={() => removeMajorSelection(major)}
                    aria-label={`Remove ${major}`}
                  >
                    <DashBadge variant="lavender">{major}</DashBadge>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="dash-profile-majors-editor__empty">No majors selected yet. Search and choose from the list below.</p>
          )}

          <div className="dash-profile-majors-editor__search">
            <SearchInput
              value={majorSearchQuery}
              onChange={(event) => setMajorSearchQuery(event.target.value)}
              placeholder="Search majors…"
            />
          </div>

          <div className="dash-profile-majors-editor__list" role="listbox" aria-label="Available majors" aria-multiselectable="true">
            {filteredMajors.map((major) => {
              const selected = majorsDraft.includes(major);
              return (
                <button
                  key={major}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "dash-profile-majors-editor__option",
                    selected && "dash-profile-majors-editor__option--selected"
                  )}
                  onClick={() => toggleMajorSelection(major)}
                >
                  {major}
                </button>
              );
            })}
            {!filteredMajors.length ? (
              <p className="dash-profile-majors-editor__empty">No majors match your search.</p>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}

const WORKSPACE_TABS = [
  { id: "essays", label: "Essays" },
  { id: "deadlines", label: "Deadlines" },
  { id: "activities", label: "Extracurriculars" },
  { id: "colleges", label: "College List" },
  { id: "scholarships", label: "Scholarships" },
  { id: "tasks", label: "Tasks" }
];

export function StudentWorkspace() {
  const location = useLocation();
  const { essays, tasks, extracurriculars, deadlines, applicationProgress: progress, addTask, toggleTask, saveEssayDraft } = useDashboardData();
  const { showToast, triggerCoinBurst } = useInteractionFeedback();
  const { play, SOUND_EVENTS } = useInterfaceSound();
  const [tab, setTab] = useState(location.state?.workspaceTab || "colleges");
  const [taskFilter, setTaskFilter] = useState("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [completedTaskIds, setCompletedTaskIds] = useState(() => new Set());
  const [justCompletedId, setJustCompletedId] = useState(null);
  const [essayTitle, setEssayTitle] = useState("");
  const [essayBody, setEssayBody] = useState("");
  const [essaySavedAt, setEssaySavedAt] = useState("");
  const isCollegesView = tab === "colleges";
  const activeEssay = essays[0] || null;
  const draftEssayId = activeEssay?.id || "new-essay";

  useEffect(() => {
    if (location.state?.workspaceTab) {
      setTab(location.state.workspaceTab);
    }
  }, [location.state?.workspaceTab]);

  useEffect(() => {
    setEssayTitle(activeEssay?.title || "");
    setEssayBody(activeEssay?.body || "");
  }, [activeEssay?.id, activeEssay?.title, activeEssay?.body]);

  useEffect(() => {
    if (tab !== "essays") return undefined;
    if (!essayTitle.trim() && !essayBody.trim()) return undefined;
    const timer = window.setTimeout(() => {
      saveEssayDraft(draftEssayId, { title: essayTitle, body: essayBody });
      setEssaySavedAt("just now");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [tab, draftEssayId, essayTitle, essayBody, saveEssayDraft]);

  const filteredTasks = tasks.filter(
    (t) => taskFilter === "all" || t.title.toLowerCase().includes(String(taskFilter).toLowerCase())
  );

  function handleToggleTask(taskId, done) {
    const wasDone = tasks.find((t) => t.id === taskId)?.done;
    void toggleTask(taskId, done);
    if (done && !wasDone && !completedTaskIds.has(taskId)) {
      setCompletedTaskIds((prev) => new Set(prev).add(taskId));
      setJustCompletedId(taskId);
      play(SOUND_EVENTS.TASK_COMPLETE);
      showToast("Task complete!");
      window.setTimeout(() => setJustCompletedId(null), 700);
      if (tasks.filter((t) => t.done).length + 1 >= 3) {
        triggerCoinBurst(5);
      }
    }
  }

  function handleAddTask() {
    const title = newTaskTitle.trim() || window.prompt("Task title");
    if (!title?.trim()) return;
    addTask(title.trim());
    setNewTaskTitle("");
  }

  const sectionPct = {
    essays: progress?.essays ?? 50,
    deadlines: 70,
    activities: progress?.extracurriculars ?? 40,
    colleges: progress?.collegeList ?? 60,
    scholarships: progress?.scholarships ?? 30,
    tasks: 55
  };

  return (
    <div className={cn("dash-page", isCollegesView ? "dash-page--colleges" : "dash-page--premium")}>
      {!isCollegesView ? (
        <>
          <DashTabs tabs={WORKSPACE_TABS} active={tab} onChange={setTab} />
          <div className="dash-workspace-progress">
            {WORKSPACE_TABS.map((t) => (
              <span key={t.id}>{t.label} · {sectionPct[t.id] ?? 0}%</span>
            ))}
          </div>
        </>
      ) : null}

      {tab === "essays" ? (
        <div className="dash-split">
          <SectionCard title="Essay editor" className="dash-editor-card dash-panel">
            <label htmlFor="workspace-essay-title" className="sr-only">Essay title</label>
            <input
              id="workspace-essay-title"
              className="dash-editor__title"
              value={essayTitle}
              onChange={(e) => setEssayTitle(e.target.value)}
            />
            <label htmlFor="workspace-essay-body" className="sr-only">Essay body</label>
            <textarea
              id="workspace-essay-body"
              className="dash-editor__body"
              rows={12}
              value={essayBody}
              onChange={(e) => setEssayBody(e.target.value)}
            />
            <p className="dash-muted">
              {(essayBody.trim().split(/\s+/).filter(Boolean).length || activeEssay?.words || 0)} words
              {essaySavedAt ? ` · Autosaved ${essaySavedAt}` : ""}
            </p>
            <div className="dash-editor__actions">
              <p className="dash-muted dash-workspace-soon">Version history is coming soon.</p>
              <Link to={`${STUDENT_DASHBOARD_BASE}/ai`} className="dash-btn dash-btn--primary">
                <Sparkles className="h-4 w-4" /> Ask Prelude AI for Feedback
              </Link>
            </div>
          </SectionCard>
          <SectionCard title="Drafts">
            {essays.map((e) => (
              <div key={e.id} className="dash-draft-row">
                <strong>{e.title}</strong>
                <DashBadge variant="soft">{e.status}</DashBadge>
                <span className="dash-muted">{e.words} words · {e.updatedAt}</span>
              </div>
            ))}
          </SectionCard>
        </div>
      ) : null}

      {tab === "colleges" ? <CollegesExplore /> : null}

      {tab === "activities" ? (
        <SectionCard title="Extracurriculars">
          {extracurriculars.length ? (
            <ul className="dash-task-list">
              {extracurriculars.map((name) => (
                <li key={name}><input type="checkbox" readOnly checked /> {name}</li>
              ))}
            </ul>
          ) : (
            <p className="dash-muted">No activities yet. Add extracurriculars from your profile or workspace.</p>
          )}
        </SectionCard>
      ) : null}

      {tab === "tasks" ? (
        <>
          <div className="dash-filter-row">
            <SearchInput value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} placeholder="Filter tasks…" />
            <PrimaryButton type="button" className="dash-btn--sm" onClick={handleAddTask}>Add task</PrimaryButton>
          </div>
          <SectionCard>
            <ul className="dash-task-list">
              {filteredTasks.map((t) => (
                <li key={t.id} className={cn("dash-task-row", justCompletedId === t.id && "dash-task-row--complete")}>
                  <input
                    type="checkbox"
                    checked={Boolean(t.done)}
                    onChange={(e) => handleToggleTask(t.id, e.target.checked)}
                  />
                  <span>{t.title}</span>
                  <DashBadge variant={t.priority === "high" ? "urgent" : "soft"}>{t.priority}</DashBadge>
                  <span className="dash-muted">Due soon</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      ) : null}

      {tab === "deadlines" ? (
        <SectionCard title="Deadlines">
          {deadlines.map((d) => (
            <DeadlineRow key={d.id} title={d.title} dueDate={d.dueDate} category={d.category} priority={d.priority} done={d.done} />
          ))}
        </SectionCard>
      ) : null}

      {tab === "scholarships" ? (
        <SectionCard title="Scholarships">
          <p className="dash-muted">
            Scholarship tracking is coming soon. Add scholarship deadlines from your{" "}
            <Link to={`${STUDENT_DASHBOARD_BASE}/overview`}>calendar</Link> for now.
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}

function MentorAvailabilityList({ availability }) {
  const slots = (availability || "")
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!slots.length) {
    return <p className="dash-muted">Availability will appear here once your mentor sets their hours.</p>;
  }
  return (
    <ul className="dash-slot-list">
      {slots.map((slot) => (
        <li key={slot}>
          <span className="dash-slot-list__time"><Clock className="h-4 w-4" /> {slot}</span>
          <DashBadge variant="soft">Open</DashBadge>
        </li>
      ))}
    </ul>
  );
}

function mentorHeadshot(mentor) {
  const mediaBase = import.meta.env.BASE_URL;
  return mentor?.headshot || `${mediaBase}media/mentors/moon-headshot.png`;
}

export function StudentMentor() {
  const { mentor, meetings, scheduleMeeting, persistCalendarItem, scheduleEventReminder } = useDashboardData();
  const m = mentor;
  const upcoming = [...(meetings || [])]
    .filter((m) => m.status !== "pending")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const nextMeeting = upcoming[0];
  const headshot = mentorHeadshot(m);

  if (!m) {
    return (
      <div className="dash-page">
        <SectionCard className="dash-panel">
          <EmptyState
            icon={UserCheck}
            title="Mentor matching in progress"
            description="We're matching you with a mentor based on your goals, intended majors, and target colleges. Completing your profile helps us find the best fit."
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/profile-stats`} className="dash-btn dash-btn--primary">
                <Pencil className="h-4 w-4" /> Complete your profile
              </Link>
            }
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="dash-page dash-page--premium">
      <div className="dash-mentor-profile">
        <SectionCard className="dash-panel dash-mentor-profile__info">
          <div className="dash-mentor-profile__id">
            <div className="dash-mentor-profile__namerow">
              <h2 className="dash-mentor-profile__name">{m.name}</h2>
              <DashBadge variant="success"><UserCheck className="h-3 w-3" /> Matched mentor</DashBadge>
            </div>
            <p className="dash-mentor-profile__role">Peer Mentor</p>
            <div className="dash-mentor-profile__chips">
              {m.university ? <span className="dash-mentor-profile__chip"><Building2 className="h-4 w-4" /> {m.university}</span> : null}
              {m.major ? <span className="dash-mentor-profile__chip"><GraduationCap className="h-4 w-4" /> {m.major}</span> : null}
              {m.graduationYear ? <span className="dash-mentor-profile__chip"><CalendarDays className="h-4 w-4" /> Class of {m.graduationYear}</span> : null}
            </div>
            {m.bio ? <p className="dash-mentor-profile__bio">{m.bio}</p> : null}
            {m.expertise?.length ? (
              <div className="dash-tags">
                {m.expertise.map((e) => <DashBadge key={e} variant="lavender">{e}</DashBadge>)}
              </div>
            ) : null}
            <div className="dash-mentor-profile__cta">
              <Link to={`${STUDENT_DASHBOARD_BASE}/messages`} className="dash-btn dash-btn--primary dash-btn--sm">
                <MessageCircle className="h-4 w-4" /> Send a message
              </Link>
              <a href="#mentor-schedule" className="dash-btn dash-btn--secondary dash-btn--sm">
                <Calendar className="h-4 w-4" /> Schedule a call
              </a>
            </div>
          </div>
        </SectionCard>

        <section className="dash-panel dash-mentor-profile__photo-card" aria-label={`Photo of ${m.name}`}>
          <img src={headshot} alt={m.name} className="dash-mentor-profile__photo" />
        </section>
      </div>

      <div className="dash-metric-row">
        <CompactStatCard icon={Calendar} label="Upcoming Sessions" value={String(upcoming.length)} />
        <CompactStatCard icon={Clock} label="Next Session" value={nextMeeting ? formatMeetingDate(nextMeeting.startTime) : "—"} />
      </div>

      <div className="dash-mentor-sessions-grid">
        <SectionCard
          title="Upcoming Sessions"
          className="dash-panel dash-mentor-sessions-grid__upcoming"
          action={<ViewAllLink to={`${STUDENT_DASHBOARD_BASE}/calendar`}>Open calendar</ViewAllLink>}
        >
          {upcoming.length ? (
            upcoming.map((meet) => (
              <MeetingCardPremium
                key={meet.id}
                meeting={meet}
                mentorName={m.name}
                role="student"
                messagePath={`${STUDENT_DASHBOARD_BASE}/messages`}
              />
            ))
          ) : (
            <EmptyState
              icon={Calendar}
              title="No sessions scheduled"
              description="Request a meeting with your mentor and it will show up here once confirmed."
              action={<a href="#mentor-schedule" className="dash-btn dash-btn--primary dash-btn--sm">Schedule meeting</a>}
            />
          )}
        </SectionCard>

        <SectionCard title="Mentor Availability" className="dash-panel dash-mentor-sessions-grid__availability">
          <div className="dash-mentor-sessions-grid__availability-inner">
            <MentorAvailabilityList availability={m.availability} />
            <a href="#mentor-schedule" className="dash-btn dash-btn--secondary dash-btn--sm">
              <Calendar className="h-4 w-4" /> Request a time
            </a>
          </div>
        </SectionCard>

        <SectionCard title="Schedule Meeting" className="dash-panel dash-mentor-sessions-grid__schedule" id="mentor-schedule">
          <p className="dash-muted">Add an event to your calendar, or send a time to your mentor for review.</p>
          <CalendarAddEventModal
            inline
            open
            role="student"
            formVariant="event"
            initialCategory="mentor_meeting"
            meetingRequestMode
            onRequestMeeting={(payload) => scheduleMeeting({ ...payload, status: "pending" })}
            onSave={async (saved) => {
              const stored = await persistCalendarItem(saved);
              scheduleEventReminder({
                id: stored.id,
                title: stored.title,
                start: stored.start,
                reminderMinutes: saved.reminderMinutes,
                formVariant: saved.formVariant
              });
            }}
            onClose={() => {}}
          />
        </SectionCard>
      </div>
    </div>
  );
}

export function StudentMessages() {
  return (
    <div className="dash-page dash-page--flush">
      <PreludeMessagesPage
        schedulePath={`${STUDENT_DASHBOARD_BASE}/mentor`}
        placeholder="Message your mentor…"
      />
    </div>
  );
}
