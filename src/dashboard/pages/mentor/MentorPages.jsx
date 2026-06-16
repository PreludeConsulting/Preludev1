import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import {
  AlertCircle,
  Calendar,
  Clock,
  Flame,
  MessageCircle,
  Users,
  Video
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { MENTOR_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import CalendarPanel from "../../components/CalendarPanel.jsx";
import MessagesPanel from "../../components/MessagesPanel.jsx";
import ScheduleMeetingForm from "../../components/ScheduleMeetingForm.jsx";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  Avatar,
  DashBadge,
  DashTabs,
  PrimaryButton,
  ProgressBar,
  SearchInput,
  SecondaryButton,
  SectionCard
} from "../../components/ui/index.jsx";
import {
  AchievementPanel,
  ActivityFeed,
  CompactStatCard,
  LevelBadge,
  MeetingCardPremium,
  MentorMissionAssign,
  MissionCard,
  OverviewHero,
  ProgressRing,
  StudentProgressCard,
  XPProgressBar
} from "../../components/ui/gamification.jsx";
import { levelFromXp } from "../../data/gamification.js";

export function MentorOverview() {
  const { user } = useAuth();
  const { meetings, students, messages, summaryCards, availability, pendingRequests, studentActivityFeed } = useDashboardData();
  const cards = summaryCards || {};
  const firstName = user?.name?.split(" ")[0] || "there";
  const attentionCount = students.filter((s) => s.needsAttention).length;

  return (
    <div className="dash-page dash-page--premium">
      <OverviewHero
        title="Your Prelude Dashboard"
        welcome={`Welcome back, ${firstName} · ${students.length} students assigned.`}
        actions={
          <>
            <Link to={`${MENTOR_DASHBOARD_BASE}/calendar`} className="dash-btn dash-btn--primary">
              <Calendar className="h-4 w-4" /> Schedule Meeting
            </Link>
            <Link to={`${MENTOR_DASHBOARD_BASE}/students`} className="dash-btn dash-btn--secondary">
              <Users className="h-4 w-4" /> View Students
            </Link>
          </>
        }
      />

      <div className="dash-metric-row dash-metric-row--5">
        <CompactStatCard icon={Users} label="Assigned Students" value={String(cards.students ?? students.length)} />
        <CompactStatCard icon={Calendar} label="Meetings This Week" value={String(cards.meetingsThisWeek ?? meetings.length)} />
        <CompactStatCard icon={Clock} label="Pending Requests" value={String(cards.pendingRequests ?? pendingRequests.length)} trend="Review" />
        <CompactStatCard icon={AlertCircle} label="Needs Attention" value={String(attentionCount)} trend="Priority" />
        <CompactStatCard icon={MessageCircle} label="Unread Messages" value={String(cards.unreadMessages ?? messages.filter((m) => m.unread).length)} />
      </div>

      <div className="dash-overview-grid dash-overview-grid--premium">
        <div className="dash-overview-grid__col">
          <SectionCard title="Student Progress Overview" className="dash-panel">
            <div className="dash-progress-card-grid">
              {students.map((s) => (
                <StudentProgressCard key={s.id} student={s} basePath={MENTOR_DASHBOARD_BASE} needsAttention={s.needsAttention} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Upcoming Meetings" className="dash-panel">
            {meetings.map((m) => {
              const student = students.find((s) => s.id === m.studentId);
              return (
                <MeetingCardPremium
                  key={m.id}
                  meeting={m}
                  studentName={student?.name || "Student"}
                  role="mentor"
                  messagePath={`${MENTOR_DASHBOARD_BASE}/messages`}
                />
              );
            })}
          </SectionCard>
        </div>

        <div className="dash-overview-grid__col">
          <SectionCard title="Pending Requests" className="dash-panel">
            {pendingRequests.length ? (
              pendingRequests.map((r) => (
                <div key={r.id} className="dash-request-row">
                  <div>
                    <p className="dash-request-row__name">{r.studentName}</p>
                    <p className="dash-muted">{r.requestedTime} · {r.type}</p>
                  </div>
                  <div className="dash-request-row__actions">
                    <PrimaryButton type="button" className="dash-btn--sm">Accept</PrimaryButton>
                    <SecondaryButton type="button" className="dash-btn--sm">Decline</SecondaryButton>
                  </div>
                </div>
              ))
            ) : (
              <p className="dash-muted">No pending requests.</p>
            )}
          </SectionCard>

          <SectionCard
            title="Availability Summary"
            className="dash-panel"
            action={<Link to={`${MENTOR_DASHBOARD_BASE}/availability`} className="dash-btn dash-btn--secondary dash-btn--sm">Edit Availability</Link>}
          >
            <ul className="dash-slot-list">
              {availability.map((s) => (
                <li key={s.id}>
                  <span>{s.day}</span>
                  <span className={s.active ? "" : "dash-muted"}>{s.time}</span>
                  {s.active ? <DashBadge variant="soft">Open</DashBadge> : <DashBadge>Closed</DashBadge>}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Student Activity Feed" className="dash-panel">
            <ActivityFeed
              items={(studentActivityFeed || []).map((a) => ({
                id: a.id,
                type: "task",
                text: a.text,
                sub: `${a.studentName} · ${a.sub}`,
                time: a.time
              }))}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export function MentorCalendar() {
  const { meetings, integrations, connectGoogle, disconnectGoogle, scheduleMeeting, events, students, mentor } = useDashboardData();
  const [filter, setFilter] = useState("");

  return (
    <div className="dash-page">
      <div className="dash-split dash-split--calendar">
        <CalendarPanel
          role="mentor"
          events={events}
          meetings={meetings}
          students={students}
          mentorName={mentor?.name || "Maya Patel"}
          googleConnected={integrations.googleCalendar?.connected}
          onConnectGoogle={connectGoogle}
          onDisconnectGoogle={disconnectGoogle}
          showStudentFilter
          studentFilter={filter}
          onStudentFilterChange={setFilter}
        />
        <SectionCard title="Approve requests">
          <ScheduleMeetingForm onSubmit={(p) => scheduleMeeting(p)} />
          <p className="dash-muted">Approving a Zoom request creates a meeting link on the student calendar.</p>
        </SectionCard>
      </div>
    </div>
  );
}

export function MentorStudents() {
  const { students } = useDashboardData();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const filtered = students
    .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "deadlines" ? b.upcomingDeadlines - a.upcomingDeadlines : a.name.localeCompare(b.name)));

  return (
    <div className="dash-page">
      <div className="dash-filter-row">
        <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" />
        <select className="dash-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="name">Sort by name</option>
          <option value="deadlines">Sort by deadlines</option>
        </select>
        <select className="dash-select" defaultValue="">
          <option value="">All grades</option>
          <option value="11">11th grade</option>
          <option value="12">12th grade</option>
        </select>
      </div>
      <div className="dash-progress-card-grid">
        {filtered.map((s) => (
          <StudentProgressCard key={s.id} student={s} basePath={MENTOR_DASHBOARD_BASE} needsAttention={s.needsAttention} />
        ))}
      </div>
    </div>
  );
}

const DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "progress", label: "Progress & XP" },
  { id: "stats", label: "Stats" },
  { id: "colleges", label: "College List" },
  { id: "essays", label: "Essays" },
  { id: "activities", label: "Extracurriculars" },
  { id: "deadlines", label: "Deadlines" },
  { id: "scholarships", label: "Scholarships" },
  { id: "tasks", label: "Tasks" },
  { id: "notes", label: "Notes" },
  { id: "meetings", label: "Meeting History" }
];

export function MentorStudentDetail() {
  const { studentId } = useParams();
  const { students, scheduleMeeting, privateNotes } = useDashboardData();
  const student = students.find((s) => s.id === studentId) || students[0];
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState(privateNotes[student?.id] || "Strong essay voice — encourage more specific examples in paragraph 2.");
  const [feedback, setFeedback] = useState("Great progress on your college list structure. Next step: tighten your reach school rationale.");
  const [customMissions, setCustomMissions] = useState([]);
  const g = student?.gamification || {};
  const level = g.level || levelFromXp(g.xp || 0);

  if (!student) return <p className="dash-muted">Student not found.</p>;

  const allMissions = [...(g.missions || []), ...customMissions];

  return (
    <div className="dash-page dash-page--premium">
      <SectionCard className="dash-student-summary dash-panel">
        <div className="dash-student-summary__head">
          <Avatar name={student.name} size="lg" />
          <div>
            <h2 className="dash-section-card__title">{student.name}</h2>
            <p className="dash-muted">{student.grade} · {student.major}</p>
            <LevelBadge level={level.level} name={level.name} />
          </div>
          <div className="dash-student-summary__actions">
            <Link to={`${MENTOR_DASHBOARD_BASE}/messages`} className="dash-btn dash-btn--secondary dash-btn--sm">Send Message</Link>
            <Link to={`${MENTOR_DASHBOARD_BASE}/calendar`} className="dash-btn dash-btn--primary dash-btn--sm">
              <Video className="h-4 w-4" /> Schedule Meeting
            </Link>
          </div>
        </div>
        <div className="dash-student-summary__metrics">
          <ProgressRing value={student.profileCompletion} />
          <XPProgressBar xp={g.xp || 0} levelInfo={level} />
          <span className="dash-hero__streak"><Flame className="h-4 w-4" /> {g.streak ?? 0}-day streak</span>
        </div>
      </SectionCard>

      <DashTabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />

      {tab === "overview" || tab === "stats" ? (
        <div className="dash-overview-grid">
          <SectionCard title="Application progress" className="dash-panel">
            <ProgressBar label="College list" value={student.profileCompletion - 8} />
            <ProgressBar label="Essays" value={student.profileCompletion - 12} />
            <ProgressBar label="Profile" value={student.profileCompletion} />
          </SectionCard>
          <SectionCard title="Current priorities" className="dash-panel">
            <ul className="dash-task-list">
              {student.priorities?.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
      ) : null}

      {tab === "progress" ? (
        <div className="dash-overview-grid">
          <SectionCard title="Weekly missions" className="dash-panel">
            {allMissions.map((m) => (
              <MissionCard key={m.id} mission={m} onToggle={() => {}} />
            ))}
            <MentorMissionAssign
              onAdd={({ title, xp, due }) =>
                setCustomMissions((prev) => [...prev, { id: `custom-${Date.now()}`, title, xp, due, priority: "medium", done: false }])
              }
            />
          </SectionCard>
          <SectionCard title="Achievements" className="dash-panel">
            <AchievementPanel badges={g.badges || []} nextBadge={g.nextBadge} />
            <ActivityFeed items={g.activityFeed || []} />
          </SectionCard>
          <SectionCard title="Encouraging feedback" className="dash-panel">
            <textarea rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Visible to student…" />
            <PrimaryButton type="button" className="dash-btn--sm">Save feedback</PrimaryButton>
          </SectionCard>
        </div>
      ) : null}

      {tab === "notes" ? (
        <div className="dash-split">
          <SectionCard title="Private mentor notes">
            <textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
            <p className="dash-muted">Students cannot see private notes.</p>
          </SectionCard>
          <SectionCard title="Visible feedback">
            <textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <PrimaryButton type="button" className="dash-btn--sm">Save feedback</PrimaryButton>
          </SectionCard>
        </div>
      ) : null}

      {tab === "meetings" ? (
        <SectionCard title="Meeting history">
          <p className="dash-muted">Last meeting: {student.lastMeeting}</p>
          <ScheduleMeetingForm defaultStudentId={student.id} onSubmit={(p) => scheduleMeeting({ ...p, studentId: student.id })} />
        </SectionCard>
      ) : null}

      {!["overview", "stats", "progress", "notes", "meetings"].includes(tab) ? (
        <SectionCard title={DETAIL_TABS.find((t) => t.id === tab)?.label}>
          <p className="dash-muted">View and coach on {tab} — connected to student workspace data.</p>
        </SectionCard>
      ) : null}
    </div>
  );
}

export function MentorMessages() {
  const { conversations, meetings } = useDashboardData();
  return (
    <div className="dash-page dash-page--flush">
      <MessagesPanel
        conversations={conversations}
        meetings={meetings}
        schedulePath={`${MENTOR_DASHBOARD_BASE}/calendar`}
        placeholder="Reply to student…"
      />
    </div>
  );
}

export function MentorAvailability() {
  const { availability, scheduleMeeting } = useDashboardData();
  const [slots, setSlots] = useState(
    availability.length
      ? availability.map((s, i) => ({ id: s.id || String(i), day: s.day, time: s.time, active: s.active !== false }))
      : [
          { id: "1", day: "Tuesday", time: "4:00–6:00 PM ET", active: true },
          { id: "2", day: "Thursday", time: "3:00–5:00 PM ET", active: true }
        ]
  );

  return (
    <div className="dash-page">
      <SectionCard title="Weekly availability">
        <ul className="dash-slot-list dash-slot-list--editable">
          {slots.map((s) => (
            <li key={s.id}>
              <span>{s.day}</span>
              <span>{s.time}</span>
              <DashBadge variant={s.active ? "soft" : "default"}>{s.active ? "Available" : "Unavailable"}</DashBadge>
              <button type="button" className="dash-link-btn" onClick={() => setSlots((all) => all.filter((x) => x.id !== s.id))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <PrimaryButton type="button" onClick={() => setSlots((all) => [...all, { id: String(Date.now()), day: "Friday", time: "2:00–4:00 PM ET", active: true }])}>
          Add time slot
        </PrimaryButton>
      </SectionCard>
      <SectionCard title="Approve meeting requests">
        <ScheduleMeetingForm onSubmit={(p) => scheduleMeeting(p)} />
      </SectionCard>
    </div>
  );
}
