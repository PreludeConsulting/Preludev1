import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Award,
  Bot,
  Building2,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  GraduationCap,
  LayoutGrid,
  ListTodo,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Sparkles,
  Target,
  UserCheck,
  Video
} from "lucide-react";
import UserAvatar from "../../../components/UserAvatar.jsx";
import { uploadAvatar, removeAvatar, validateAvatarFile } from "../../../lib/supabaseStorage.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { requestPasswordReset } from "../../../lib/auth.js";
import { cn } from "../../../lib/utils.js";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import CalendarPanel from "../../components/CalendarPanel.jsx";
import IntegrationConnect from "../../components/IntegrationConnect.jsx";
import MessagesPanel from "../../components/MessagesPanel.jsx";
import PreludeChatPanel from "../../components/PreludeChatPanel.jsx";
import ScheduleMeetingForm from "../../components/ScheduleMeetingForm.jsx";
import { PLACEHOLDER_COLLEGES, PLACEHOLDER_ESSAYS } from "../../data/placeholders.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import { loadPreferences, savePreferences as saveLocalPreferences } from "../../lib/dashboardPreferences.js";
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
  ViewAllLink
} from "../../components/ui/index.jsx";
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
import StudentOverviewProduct from "../../components/product/StudentOverviewProduct.jsx";

/* ——— Shared presentational helpers for the redesigned pages ——— */

function EmptyPrompt({ text }) {
  return (
    <p className="dash-empty-prompt">
      <Sparkles className="h-4 w-4" aria-hidden="true" /> {text}
    </p>
  );
}

function SettingToggle({ id, checked, onChange, label, description }) {
  return (
    <div className="dash-setting-row">
      <div className="dash-setting-row__text">
        <label htmlFor={id} className="dash-setting-row__label">{label}</label>
        {description ? <p className="dash-setting-row__desc">{description}</p> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={cn("dash-toggle", checked && "dash-toggle--on")}
        onClick={() => onChange(!checked)}
      >
        <span className="dash-toggle__thumb" />
      </button>
    </div>
  );
}

const MEETING_TYPE_META = {
  zoom: { label: "Zoom", icon: Video },
  in_person: { label: "In person", icon: MapPin },
  phone: { label: "Phone", icon: Clock }
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
      {meeting.meetingType === "zoom" && meeting.zoomJoinUrl ? (
        <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--secondary dash-btn--sm">
          <Video className="h-4 w-4" /> Join
        </a>
      ) : null}
    </article>
  );
}

export function StudentOverview() {
  return <StudentOverviewProduct />;
}

const CALENDAR_LEGEND = [
  { label: "Mentor meeting", color: "#7c6cff" },
  { label: "Application deadline", color: "#232730" },
  { label: "Essay deadline", color: "#2563eb" },
  { label: "Scholarship deadline", color: "#9a6700" },
  { label: "Mentor availability", color: "#5b4fd6" }
];

export function StudentCalendar() {
  const { meetings, integrations, connectGoogle, disconnectGoogle, scheduleMeeting, events, profile, mentor } = useDashboardData();
  const upcoming = [...(meetings || [])].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <div className="dash-page dash-page--premium">
      <div className="dash-calendar-layout">
        <div className="dash-calendar-layout__main">
          <CalendarPanel
            role="student"
            events={events}
            studentId={profile?.slug}
            meetings={meetings}
            mentorName={mentor?.name}
            googleConnected={integrations.googleCalendar?.connected}
            onConnectGoogle={connectGoogle}
            onDisconnectGoogle={disconnectGoogle}
          />
        </div>

        <aside className="dash-calendar-layout__side">
          <SectionCard
            title="Upcoming meetings"
            className="dash-panel"
            action={upcoming.length ? <DashBadge variant="soft">{upcoming.length}</DashBadge> : null}
          >
            {upcoming.length ? (
              <div className="dash-upcoming-list">
                {upcoming.map((meeting) => (
                  <UpcomingMeetingCard key={meeting.id} meeting={meeting} mentorName={mentor?.name} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Calendar}
                title="No meetings scheduled"
                description="Request a meeting with your mentor and it will appear here and on your calendar."
                action={<a href="#calendar-schedule" className="dash-btn dash-btn--primary dash-btn--sm">Schedule a meeting</a>}
              />
            )}
          </SectionCard>

          <SectionCard title="Schedule a meeting" className="dash-panel" id="calendar-schedule">
            <p className="dash-muted">Pick a time and your mentor will confirm the request.</p>
            <ScheduleMeetingForm
              compact
              onSubmit={async (p) => {
                await scheduleMeeting({ ...p, status: "pending" });
              }}
            />
          </SectionCard>

          <SectionCard title="Legend" className="dash-panel">
            <ul className="dash-legend-list">
              {CALENDAR_LEGEND.map((item) => (
                <li key={item.label}>
                  <span className="dash-legend-list__dot" style={{ background: item.color }} aria-hidden="true" />
                  {item.label}
                </li>
              ))}
            </ul>
          </SectionCard>
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

const PROFILE_SECTIONS = [
  { id: "academic", title: "Academic Profile", fields: ["Grade level", "Graduation year", "GPA", "Weighted GPA", "SAT score", "ACT score"] },
  { id: "college", title: "College Preferences", fields: ["Intended majors", "Preferred colleges", "Location preferences", "College size preferences", "Budget / financial aid"] },
  { id: "activities", title: "Extracurricular Activities", fields: ["Activities"], textarea: true },
  { id: "awards", title: "Awards and Honors", fields: ["Awards"], textarea: true },
  { id: "leadership", title: "Leadership", fields: ["Leadership roles"], textarea: true },
  { id: "volunteer", title: "Volunteer Experience", fields: ["Volunteer work"], textarea: true },
  { id: "work", title: "Work Experience", fields: ["Work experience"], textarea: true }
];

function profileFieldValues(profile) {
  return {
    "Grade level": profile?.grade ?? "",
    "Graduation year": profile?.graduationYear ?? "",
    GPA: profile?.gpa ?? "",
    "Weighted GPA": profile?.weightedGpa ?? "",
    "SAT score": profile?.sat ?? "",
    "Intended majors": (profile?.targetMajors || profile?.majors || []).join(", "),
    "Preferred colleges": (profile?.collegeInterests || profile?.colleges || []).join(", ")
  };
}

export function StudentProfileStats() {
  const { user } = useAuth();
  const { profile, mentor, onboarding, saveProfile, saveOnboarding, useSupabaseData } = useDashboardData();
  const [form, setForm] = useState(() => profileFieldValues(profile));
  const [completion, setCompletion] = useState(onboarding?.profileComplete ?? profile?.profileCompletion ?? 0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const majors = profile?.targetMajors || profile?.majors || [];
  const colleges = profile?.collegeInterests || profile?.colleges || [];

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const nextCompletion = Math.min(100, completion + 12);
      if (useSupabaseData) {
        await saveProfile({
          gradeLevel: form["Grade level"],
          graduationYear: form["Graduation year"],
          gpa: form.GPA,
          weightedGpa: form["Weighted GPA"],
          sat: form["SAT score"],
          targetMajors: form["Intended majors"].split(",").map((s) => s.trim()).filter(Boolean),
          collegeInterests: form["Preferred colleges"].split(",").map((s) => s.trim()).filter(Boolean)
        });
        await saveOnboarding({ profileComplete: nextCompletion });
      }
      setCompletion(nextCompletion);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    } catch (err) {
      setError(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  function updateField(label, value) {
    setForm((f) => ({ ...f, [label]: value }));
  }

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
              {profile?.grade ? <DashBadge variant="lavender">{profile.grade}</DashBadge> : null}
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
        <CompactStatCard icon={GraduationCap} label="Grade" value={profile?.grade || "—"} />
        <CompactStatCard icon={CalendarDays} label="Graduation Year" value={profile?.graduationYear || "—"} />
        <CompactStatCard icon={Target} label="GPA" value={profile?.gpa != null ? String(profile.gpa) : "—"} />
        <CompactStatCard icon={Award} label="SAT" value={profile?.sat != null ? String(profile.sat) : "—"} />
      </div>

      <div className="dash-overview-grid dash-overview-grid--premium">
        <div className="dash-overview-grid__col">
          <SectionCard title="Intended majors" className="dash-panel">
            {majors.length ? (
              <div className="dash-tags">{majors.map((mj) => <DashBadge key={mj} variant="lavender">{mj}</DashBadge>)}</div>
            ) : (
              <EmptyPrompt text="Add the majors you're considering so your mentor can tailor school suggestions." />
            )}
          </SectionCard>

          <SectionCard
            title="College goals"
            className="dash-panel"
            action={<ViewAllLink to={`${STUDENT_DASHBOARD_BASE}/workspace`}>Open workspace</ViewAllLink>}
          >
            {colleges.length ? (
              <ul className="dash-goal-list">
                {colleges.map((college) => (
                  <li key={college}><Building2 className="h-4 w-4" /> {college}</li>
                ))}
              </ul>
            ) : (
              <EmptyPrompt text="Add target colleges to start building a balanced list." />
            )}
          </SectionCard>
        </div>

        <div className="dash-overview-grid__col">
          <SectionCard title="Academic snapshot" className="dash-panel">
            <dl className="dash-kv">
              <div><dt>Grade</dt><dd>{profile?.grade || "—"}</dd></div>
              <div><dt>Graduation</dt><dd>{profile?.graduationYear || "—"}</dd></div>
              <div><dt>GPA</dt><dd>{profile?.gpa ?? "—"}</dd></div>
              <div><dt>Weighted GPA</dt><dd>{profile?.weightedGpa ?? "—"}</dd></div>
              <div><dt>SAT</dt><dd>{profile?.sat ?? "—"}</dd></div>
              <div><dt>Mentor</dt><dd>{mentor?.name || profile?.mentorName || "—"}</dd></div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <form id="profile-edit" className="dash-profile-form" onSubmit={handleSave}>
        <div className="dash-section-heading">
          <h2 className="dash-section-heading__title">Edit profile details</h2>
          <p className="dash-muted">Update each section, then save your changes.</p>
        </div>

        <div className="dash-profile-grid">
          {PROFILE_SECTIONS.map((section) => (
            <SectionCard key={section.id} title={section.title} className="dash-panel">
              {section.fields.map((label) => (
                <label key={label} className="prelude-field">
                  <span>{label}</span>
                  <input
                    value={form[label] ?? ""}
                    onChange={(e) => updateField(label, e.target.value)}
                    placeholder={label}
                  />
                </label>
              ))}
            </SectionCard>
          ))}
        </div>

        <div className="dash-form-actions">
          {error ? <span className="dash-save-state dash-save-state--err">{error}</span> : null}
          {saved ? (
            <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Profile saved</span>
          ) : null}
          <PrimaryButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</PrimaryButton>
        </div>
      </form>
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
  const { essays, tasks, extracurriculars, deadlines, applicationProgress: progress } = useDashboardData();
  const [tab, setTab] = useState(location.state?.workspaceTab || "essays");
  const [taskFilter, setTaskFilter] = useState("all");

  const sectionPct = {
    essays: progress?.essays ?? 50,
    deadlines: 70,
    activities: progress?.extracurriculars ?? 40,
    colleges: progress?.collegeList ?? 60,
    scholarships: progress?.scholarships ?? 30,
    tasks: 55
  };

  return (
    <div className="dash-page dash-page--premium">
      <DashTabs tabs={WORKSPACE_TABS} active={tab} onChange={setTab} />
      <div className="dash-workspace-progress">
        {WORKSPACE_TABS.map((t) => (
          <span key={t.id}>{t.label} · {sectionPct[t.id] ?? 0}%</span>
        ))}
      </div>

      {tab === "essays" ? (
        <div className="dash-split">
          <SectionCard title="Essay editor" className="dash-editor-card dash-panel">
            <input className="dash-editor__title" defaultValue={essays[0]?.title || PLACEHOLDER_ESSAYS[0].title} />
            <textarea className="dash-editor__body" rows={12} defaultValue="Growing up, I learned to debug problems before I learned to drive…" />
            <p className="dash-muted">{essays[0]?.words || 412} words · Autosaved just now</p>
            <div className="dash-editor__actions">
              <SecondaryButton type="button">Version history</SecondaryButton>
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

      {tab === "colleges" ? (
        <div className="dash-table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>College</th>
                <th>Tier</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_COLLEGES.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td><DashBadge variant={c.tier === "Reach" ? "urgent" : "lavender"}>{c.tier}</DashBadge></td>
                  <td>{c.deadline}</td>
                  <td>{c.status}</td>
                  <td className="dash-muted">—</td>
                  <td><button type="button" className="dash-link-btn">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "activities" ? (
        <SectionCard title="Extracurriculars">
          <ul className="dash-task-list">
            {(extracurriculars.length ? extracurriculars : ["Add your activities"]).map((name) => (
              <li key={name}><input type="checkbox" readOnly checked /> {name}</li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {tab === "tasks" ? (
        <>
          <div className="dash-filter-row">
            <SearchInput value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} placeholder="Filter tasks…" />
            <PrimaryButton type="button" className="dash-btn--sm">Add task</PrimaryButton>
          </div>
          <SectionCard>
            <ul className="dash-task-list">
              {tasks.map((t) => (
                <li key={t.id} className="dash-task-row">
                  <input type="checkbox" defaultChecked={t.done} />
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
          <p className="dash-muted">Track scholarship deadlines and essay requirements — synced with your calendar when saved.</p>
          <PrimaryButton type="button" className="dash-btn--sm">Add scholarship</PrimaryButton>
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

function MentorMessagePreview({ messages, mentorName }) {
  if (!messages.length) {
    return <p className="dash-muted">No messages yet. Start the conversation with your mentor.</p>;
  }
  return (
    <ul className="dash-msg-preview">
      {messages.map((msg) => (
        <li key={msg.id} className={cn("dash-msg-preview__row", msg.sender === "me" && "dash-msg-preview__row--me")}>
          <span className="dash-msg-preview__who">{msg.sender === "me" ? "You" : mentorName}</span>
          <p className="dash-msg-preview__text">{msg.body || msg.text}</p>
        </li>
      ))}
    </ul>
  );
}

export function StudentMentor() {
  const { mentor, meetings, conversations, profile, scheduleMeeting } = useDashboardData();
  const m = mentor;
  const upcoming = [...(meetings || [])].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  const nextMeeting = upcoming[0];
  const mentorThread = conversations?.[0];
  const recentMessages = (mentorThread?.messages || []).slice(-3);
  const completion = profile?.profileCompletion ?? null;

  if (!m) {
    return (
      <div className="dash-page">
        <SectionCard className="dash-panel">
          <EmptyState
            icon={UserCheck}
            title="No mentors yet"
            description="Start mentor matching to tell us about your goals. When a mentor is assigned, they will appear here with session scheduling and messaging."
            action={
              <Link to={`${STUDENT_DASHBOARD_BASE}/prelude-match`} className="dash-btn dash-btn--primary">
                <Sparkles className="h-4 w-4" /> Start Matching
              </Link>
            }
          />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="dash-page dash-page--premium">
      <SectionCard className="dash-mentor-hero dash-panel" padding={false}>
        <div className="dash-mentor-hero__inner">
          <Avatar name={m.name} size="lg" />
          <div className="dash-mentor-hero__id">
            <div className="dash-mentor-hero__namerow">
              <h2 className="dash-mentor-hero__name">{m.name}</h2>
              <DashBadge variant="success"><UserCheck className="h-3 w-3" /> Matched mentor</DashBadge>
            </div>
            <p className="dash-mentor-hero__role">Peer Mentor</p>
            <div className="dash-mentor-hero__chips">
              {m.university ? <span className="dash-mentor-hero__chip"><Building2 className="h-4 w-4" /> {m.university}</span> : null}
              {m.major ? <span className="dash-mentor-hero__chip"><GraduationCap className="h-4 w-4" /> {m.major}</span> : null}
              {m.graduationYear ? <span className="dash-mentor-hero__chip"><CalendarDays className="h-4 w-4" /> Class of {m.graduationYear}</span> : null}
            </div>
            {m.bio ? <p className="dash-mentor-hero__bio">{m.bio}</p> : null}
            {m.expertise?.length ? (
              <div className="dash-tags">
                {m.expertise.map((e) => <DashBadge key={e} variant="lavender">{e}</DashBadge>)}
              </div>
            ) : null}
            <div className="dash-mentor-hero__cta">
              <Link to={`${STUDENT_DASHBOARD_BASE}/messages`} className="dash-btn dash-btn--primary dash-btn--sm">
                <MessageCircle className="h-4 w-4" /> Send a message
              </Link>
              <a href="#mentor-schedule" className="dash-btn dash-btn--secondary dash-btn--sm">
                <Calendar className="h-4 w-4" /> Schedule a call
              </a>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="dash-metric-row">
        <CompactStatCard icon={Calendar} label="Upcoming Sessions" value={String(upcoming.length)} />
        <CompactStatCard icon={Clock} label="Next Session" value={nextMeeting ? formatMeetingDate(nextMeeting.startTime) : "—"} />
        <CompactStatCard icon={MessageCircle} label="Conversations" value={String(conversations?.length || 0)} />
        {completion != null ? (
          <CompactStatCard icon={Target} label="Profile Completion" value={`${completion}%`} progress={completion} />
        ) : null}
      </div>

      <div className="dash-overview-grid dash-overview-grid--premium">
        <div className="dash-overview-grid__col">
          <SectionCard
            title="Upcoming Sessions"
            className="dash-panel"
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
                description="Request a meeting with your mentor and it will show up here."
                action={<a href="#mentor-schedule" className="dash-btn dash-btn--primary dash-btn--sm">Schedule a session</a>}
              />
            )}
          </SectionCard>

          <SectionCard title="Schedule a session" className="dash-panel" id="mentor-schedule">
            <p className="dash-muted">Request a time and your mentor will confirm the meeting.</p>
            <ScheduleMeetingForm compact onSubmit={(p) => scheduleMeeting({ ...p, status: "pending" })} />
          </SectionCard>
        </div>

        <div className="dash-overview-grid__col">
          <SectionCard title="Mentor Availability" className="dash-panel">
            <MentorAvailabilityList availability={m.availability} />
            <a href="#mentor-schedule" className="dash-btn dash-btn--secondary dash-btn--sm">
              <Calendar className="h-4 w-4" /> Request a time
            </a>
          </SectionCard>

          <SectionCard
            title="Recent Messages"
            className="dash-panel"
            action={<ViewAllLink to={`${STUDENT_DASHBOARD_BASE}/messages`}>Open inbox</ViewAllLink>}
          >
            <MentorMessagePreview messages={recentMessages} mentorName={m.name} />
            <Link to={`${STUDENT_DASHBOARD_BASE}/messages`} className="dash-btn dash-btn--secondary dash-btn--sm">
              <MessageCircle className="h-4 w-4" /> Reply
            </Link>
          </SectionCard>

          <SectionCard title="How your mentor can help" className="dash-panel">
            <ul className="dash-help-list">
              {(m.expertise?.length ? m.expertise : ["College list strategy", "Essay feedback", "Application planning"]).map((item) => (
                <li key={item}>
                  <CheckCircle2 className="h-4 w-4" /> {item}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export function StudentMessages() {
  const { conversations, meetings, messages, isDemo } = useDashboardData();
  const hasMessages = conversations?.length > 0 || messages?.length > 0;

  if (!hasMessages && !isDemo) {
    return (
      <div className="dash-page dash-page--premium">
        <EmptyState
          icon={MessageCircle}
          title="No messages yet"
          description="Your conversations with mentors will appear here once you're matched and start chatting."
          action={
            <Link to={`${STUDENT_DASHBOARD_BASE}/prelude-match`} className="dash-btn dash-btn--primary dash-btn--sm">
              Start Mentor Matching
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="dash-page dash-page--flush">
      <MessagesPanel
        conversations={conversations}
        meetings={meetings}
        schedulePath={`${STUDENT_DASHBOARD_BASE}/mentor`}
        placeholder="Message your mentor…"
      />
    </div>
  );
}

const SETTINGS_TABS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "calendar", label: "Calendar & meetings" },
  { id: "display", label: "Appearance" },
  { id: "integrations", label: "Connected accounts" },
  { id: "security", label: "Privacy & security" },
  { id: "support", label: "Support" }
];

function ProfilePhotoSection({ user, refreshUser }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoOk, setPhotoOk] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    const validation = validateAvatarFile(file);
    if (validation) {
      setPhotoError(validation);
      return;
    }
    setUploading(true);
    setPhotoError("");
    try {
      const { error } = await uploadAvatar(user.id, file);
      if (error) throw new Error(error);
      await refreshUser();
      setPhotoOk(true);
      window.setTimeout(() => setPhotoOk(false), 2600);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    setPhotoError("");
    try {
      const { error } = await removeAvatar(user.id);
      if (error) throw new Error(error);
      await refreshUser();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <SectionCard id="profile" title="Profile picture" className="dash-panel">
      <div className="dash-profile-photo">
        <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size="lg" />
        <div className="dash-profile-photo__actions">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handleFileChange} />
          <PrimaryButton type="button" className="dash-btn--sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Upload photo"}
          </PrimaryButton>
          {user?.avatarUrl ? (
            <SecondaryButton type="button" className="dash-btn--sm" disabled={uploading} onClick={handleRemove}>
              Remove photo
            </SecondaryButton>
          ) : null}
          <p className="dash-muted">JPG, PNG, WebP, or GIF · max 5 MB</p>
          {photoError ? <p className="dash-save-state dash-save-state--err">{photoError}</p> : null}
          {photoOk ? <p className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Photo updated</p> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function SettingSelect({ id, label, description, value, onChange, options }) {
  return (
    <div className="dash-setting-row">
      <div className="dash-setting-row__text">
        <label htmlFor={id} className="dash-setting-row__label">{label}</label>
        {description ? <p className="dash-setting-row__desc">{description}</p> : null}
      </div>
      <select id={id} className="dash-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function SaveRow({ section, savedSection, onSave }) {
  return (
    <div className="dash-form-actions">
      {savedSection === section ? (
        <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Saved</span>
      ) : null}
      <PrimaryButton type="button" className="dash-btn--sm" onClick={() => onSave(section)}>Save changes</PrimaryButton>
    </div>
  );
}

export function StudentProfileSettings() {
  const { user, planDetails, openAccount, signOut, useSupabase, refreshUser } = useAuth();
  const { integrations, connectGoogle, disconnectGoogle, connectZoomAccount, disconnectZoomAccount, preferences, savePreferences, saveProfile, profile, useSupabaseData } = useDashboardData();
  const [tab, setTab] = useState("profile");
  const [prefs, setPrefs] = useState(() => preferences || loadPreferences());
  const [savedSection, setSavedSection] = useState("");
  const [resetState, setResetState] = useState("idle");
  const [profileForm, setProfileForm] = useState({
    academicGoals: profile?.academicGoals || "",
    collegeInterests: (profile?.collegeInterests || []).join(", "),
    mentorPreferences: profile?.mentorPreferences?.notes || "",
    gpa: profile?.gpa || "",
    graduationYear: profile?.graduationYear || ""
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (preferences) setPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (window.location.hash === "#profile") setTab("profile");
  }, []);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        academicGoals: profile.academicGoals || "",
        collegeInterests: (profile.collegeInterests || []).join(", "),
        mentorPreferences: profile.mentorPreferences?.notes || "",
        gpa: profile.gpa || "",
        graduationYear: profile.graduationYear || ""
      });
    }
  }, [profile]);

  const roleLabel = user?.role === "mentor" ? "Mentor" : "Student";
  const planName = planDetails?.name || user?.planName || "Basic";

  function setPref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function saveSection(section) {
    if (useSupabaseData) {
      await savePreferences(prefs);
    } else {
      saveLocalPreferences(prefs);
    }
    setSavedSection(section);
    window.setTimeout(() => setSavedSection(""), 2600);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetState("sending");
    try {
      if (useSupabase) {
        const { resetPassword } = await import("../../../lib/supabaseAuth.js");
        const { error } = await resetPassword(user.email);
        if (error) throw new Error(error);
      } else {
        await requestPasswordReset(user.email);
      }
      setResetState("sent");
    } catch {
      setResetState("error");
    }
  }

  async function handleProfileSave(event) {
    event.preventDefault();
    if (!useSupabaseData) {
      setSavedSection("profile");
      window.setTimeout(() => setSavedSection(""), 2600);
      return;
    }
    setProfileSaving(true);
    try {
      await saveProfile({
        academicGoals: profileForm.academicGoals,
        collegeInterests: profileForm.collegeInterests.split(",").map((s) => s.trim()).filter(Boolean),
        mentorPreferences: { notes: profileForm.mentorPreferences },
        gpa: profileForm.gpa,
        graduationYear: profileForm.graduationYear
      });
      setSavedSection("profile");
      window.setTimeout(() => setSavedSection(""), 2600);
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div className="dash-page dash-page--premium">
      <SectionCard className="dash-settings-id dash-panel" padding={false}>
        <div className="dash-settings-id__inner">
          <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} size="lg" />
          <div className="dash-settings-id__text">
            <h2 className="dash-settings-id__name">{user?.name || "Your account"}</h2>
            <p className="dash-settings-id__email"><Mail className="h-4 w-4" /> {user?.email || "—"}</p>
            <div className="dash-settings-id__badges">
              <DashBadge variant="soft">{roleLabel}</DashBadge>
              <DashBadge variant="lavender">{planName} plan</DashBadge>
            </div>
          </div>
          <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={openAccount}>
            Account &amp; plan
          </button>
        </div>
      </SectionCard>

      <div className="dash-settings">
        <div className="dash-settings__nav">
          <DashTabs tabs={SETTINGS_TABS} active={tab} onChange={setTab} />
        </div>

        <div className="dash-settings__panel">
          {tab === "profile" ? (
            <>
              <ProfilePhotoSection user={user} refreshUser={refreshUser} />
              <SectionCard title="Profile information" className="dash-panel">
                <form className="dash-profile-form" onSubmit={handleProfileSave}>
                  <dl className="dash-kv">
                    <div><dt>Full name</dt><dd>{user?.name || "—"}</dd></div>
                    <div><dt>Email</dt><dd>{user?.email || "—"}</dd></div>
                    <div><dt>Role</dt><dd>{roleLabel}</dd></div>
                    <div><dt>Plan</dt><dd>{planName}</dd></div>
                  </dl>
                  <label className="prelude-field">
                    <span>Academic goals</span>
                    <textarea rows={3} value={profileForm.academicGoals} onChange={(e) => setProfileForm((f) => ({ ...f, academicGoals: e.target.value }))} />
                  </label>
                  <label className="prelude-field">
                    <span>College interests</span>
                    <input value={profileForm.collegeInterests} onChange={(e) => setProfileForm((f) => ({ ...f, collegeInterests: e.target.value }))} placeholder="Stanford, UCLA, liberal arts colleges…" />
                  </label>
                  <label className="prelude-field">
                    <span>Mentor preferences</span>
                    <textarea rows={3} value={profileForm.mentorPreferences} onChange={(e) => setProfileForm((f) => ({ ...f, mentorPreferences: e.target.value }))} placeholder="Support style, meeting frequency, areas of focus…" />
                  </label>
                  <label className="prelude-field">
                    <span>GPA</span>
                    <input value={profileForm.gpa} onChange={(e) => setProfileForm((f) => ({ ...f, gpa: e.target.value }))} />
                  </label>
                  <label className="prelude-field">
                    <span>Graduation year</span>
                    <input value={profileForm.graduationYear} onChange={(e) => setProfileForm((f) => ({ ...f, graduationYear: e.target.value }))} />
                  </label>
                  <div className="dash-form-actions">
                    {savedSection === "profile" ? (
                      <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Profile saved</span>
                    ) : null}
                    <PrimaryButton type="submit" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save profile"}</PrimaryButton>
                  </div>
                </form>
              </SectionCard>

              <SectionCard title="Account management" className="dash-panel">
                <button type="button" className="dash-setting-link" onClick={openAccount}>
                  <span><span className="dash-setting-link__label">Account &amp; plan</span><span className="dash-setting-link__desc">View your subscription and billing details.</span></span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <Link to={`${STUDENT_DASHBOARD_BASE}/billing`} className="dash-setting-link">
                  <span><span className="dash-setting-link__label">Plans and billing</span><span className="dash-setting-link__desc">View or change your subscription.</span></span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link to={`${STUDENT_DASHBOARD_BASE}/help`} className="dash-setting-link">
                  <span><span className="dash-setting-link__label">Help and support</span><span className="dash-setting-link__desc">Contact Prelude or browse common questions.</span></span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <button type="button" className="dash-setting-link" onClick={handleSignOut}>
                  <span><span className="dash-setting-link__label">Sign out</span><span className="dash-setting-link__desc">Sign out of Prelude on this device.</span></span>
                  <ChevronRight className="h-4 w-4" />
                </button>
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
              <p className="dash-muted">Defaults for how your calendar and meeting reminders behave.</p>
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
              <p className="dash-muted">These apply to your dashboard on this device.</p>
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
                description="Minimize animations and transitions across the dashboard."
                checked={prefs.reduceMotion}
                onChange={(v) => setPref("reduceMotion", v)}
              />
              <SaveRow section="display" savedSection={savedSection} onSave={saveSection} />
            </SectionCard>
          ) : null}

          {tab === "integrations" ? (
            <SectionCard title="Connected accounts" className="dash-panel">
              <p className="dash-muted">Connect the tools you use for scheduling and meetings.</p>
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

          {tab === "security" ? (
            <>
              <SectionCard title="Password &amp; login" className="dash-panel">
                <div className="dash-setting-row">
                  <div className="dash-setting-row__text">
                    <span className="dash-setting-row__label"><Lock className="h-4 w-4" /> Password</span>
                    <p className="dash-setting-row__desc">We'll email a secure link to reset your password.</p>
                  </div>
                  <SecondaryButton type="button" className="dash-btn--sm" onClick={handlePasswordReset} disabled={resetState === "sending"}>
                    {resetState === "sending" ? "Sending…" : "Send reset link"}
                  </SecondaryButton>
                </div>
                {resetState === "sent" ? (
                  <span className="dash-save-state dash-save-state--ok"><Check className="h-4 w-4" /> Reset link sent to {user?.email}</span>
                ) : null}
                {resetState === "error" ? (
                  <span className="dash-save-state dash-save-state--err">Couldn't send a reset link. Please try again.</span>
                ) : null}
              </SectionCard>

              <SectionCard title="Privacy" className="dash-panel">
                <p className="dash-muted">Your profile is visible to your matched mentor so they can support your applications. Manage your account and data from Account &amp; plan.</p>
                <button type="button" className="dash-setting-link" onClick={openAccount}>
                  <span><span className="dash-setting-link__label">Manage account &amp; data</span><span className="dash-setting-link__desc">Subscription, billing, and account options.</span></span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </SectionCard>
            </>
          ) : null}

          {tab === "support" ? (
            <SectionCard title="Support &amp; account management" className="dash-panel">
              <a className="dash-setting-link" href="mailto:hello@preludeconsulting.com">
                <span><span className="dash-setting-link__label"><Mail className="h-4 w-4" /> Contact support</span><span className="dash-setting-link__desc">hello@preludeconsulting.com</span></span>
                <ChevronRight className="h-4 w-4" />
              </a>
              <button type="button" className="dash-setting-link" onClick={openAccount}>
                <span><span className="dash-setting-link__label">Account &amp; plan</span><span className="dash-setting-link__desc">View or change your subscription.</span></span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
