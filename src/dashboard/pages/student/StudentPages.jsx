import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Bot,
  Calendar,
  FileText,
  Flame,
  GraduationCap,
  LayoutGrid,
  ListTodo,
  Sparkles,
  Target
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { STUDENT_DASHBOARD_BASE } from "../../../lib/dashboardRoutes.js";
import CalendarPanel from "../../components/CalendarPanel.jsx";
import IntegrationConnect from "../../components/IntegrationConnect.jsx";
import MessagesPanel from "../../components/MessagesPanel.jsx";
import PreludeChatPanel from "../../components/PreludeChatPanel.jsx";
import ScheduleMeetingForm from "../../components/ScheduleMeetingForm.jsx";
import { PLACEHOLDER_COLLEGES, PLACEHOLDER_ESSAYS } from "../../data/placeholders.js";
import { useDashboardData } from "../../context/DashboardDataContext.jsx";
import {
  DashBadge,
  DashTabs,
  DeadlineRow,
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
  OverviewHero
} from "../../components/ui/gamification.jsx";
import { useGamification } from "../../context/GamificationContext.jsx";

export function StudentOverview() {
  const { user } = useAuth();
  const { meetings, mentor, summaryCards, aiSuggestions, profile, deadlines, applicationProgress } = useDashboardData();
  const gamification = useGamification();
  const cards = summaryCards || {};
  const nextMeeting = meetings[0];
  const progress = applicationProgress || { collegeList: 60, essays: 50, extracurriculars: 40, scholarships: 30, profile: profile?.profileCompletion || 62 };
  const firstName = user?.name?.split(" ")[0] || "there";
  const appPct = gamification?.applicationProgressPct ?? Math.round((progress.collegeList + progress.essays + progress.profile) / 3);
  const level = gamification?.level;

  return (
    <div className="dash-page dash-page--premium">
      <OverviewHero
        title="Your Prelude Dashboard"
        welcome={`Welcome back, ${firstName}.`}
        gamified
        levelInfo={level}
        xp={gamification?.xp ?? 0}
        streak={gamification?.streak ?? 0}
        actions={
          <>
            <Link to={`${STUDENT_DASHBOARD_BASE}/ai`} className="dash-btn dash-btn--primary">
              <Bot className="h-4 w-4" /> Ask Prelude AI
            </Link>
            <Link to={`${STUDENT_DASHBOARD_BASE}/mentor`} className="dash-btn dash-btn--secondary">
              <Calendar className="h-4 w-4" /> Schedule Mentor Meeting
            </Link>
          </>
        }
      />

      <div className="dash-metric-row">
        <CompactStatCard icon={LayoutGrid} label="Application Progress" value={`${appPct}%`} progress={appPct} trend="On track" />
        <CompactStatCard icon={ListTodo} label="Upcoming Deadlines" value={String(cards.deadlines ?? 4)} trend="This week" />
        <CompactStatCard icon={FileText} label="Essay Progress" value={cards.essayProgress ?? "68%"} progress={progress.essays} />
        <CompactStatCard icon={Target} label="Profile Completion" value={`${cards.profileCompletion ?? profile?.profileCompletion ?? 0}%`} progress={progress.profile} />
        <CompactStatCard icon={Flame} label="Current Streak" value={`${gamification?.streak ?? 0} days`} trend="Personal best" />
      </div>

      <div className="dash-overview-grid dash-overview-grid--premium">
        <div className="dash-overview-grid__col">
          <SectionCard title="Weekly Missions" className="dash-panel">
            {(gamification?.missions ?? []).map((m) => (
              <MissionCard key={m.id} mission={m} onToggle={gamification?.completeMission} />
            ))}
          </SectionCard>

          <SectionCard title="Application Progress" className="dash-panel">
            <ProgressBar label="College List" value={progress.collegeList} />
            <ProgressBar label="Essays" value={progress.essays} />
            <ProgressBar label="Extracurricular Activities" value={progress.extracurriculars} />
            <ProgressBar label="Scholarships" value={progress.scholarships} />
            <ProgressBar label="Profile Completion" value={progress.profile} />
          </SectionCard>

          <SectionCard
            title="Upcoming Deadlines"
            className="dash-panel"
            action={<ViewAllLink to={`${STUDENT_DASHBOARD_BASE}/workspace`}>View all</ViewAllLink>}
          >
            {(deadlines.length ? deadlines : []).slice(0, 4).map((d) => (
              <DeadlineRow key={d.id} title={d.title} dueDate={d.dueDate} category={d.category} priority={d.priority} done={d.done} />
            ))}
          </SectionCard>
        </div>

        <div className="dash-overview-grid__col">
          <SectionCard title="Next Mentor Meeting" className="dash-panel">
            {nextMeeting ? (
              <MeetingCardPremium
                meeting={nextMeeting}
                mentorName={mentor.name}
                role="student"
                messagePath={`${STUDENT_DASHBOARD_BASE}/messages`}
              />
            ) : (
              <p className="dash-muted">No meetings scheduled. <Link to={`${STUDENT_DASHBOARD_BASE}/mentor`}>Schedule with your mentor</Link>.</p>
            )}
          </SectionCard>

          <SectionCard title="Prelude AI Insights" className="dash-panel">
            <InsightList
              items={aiSuggestions.length ? aiSuggestions : ["Focus on your personal statement this week."]}
              actionLink={`${STUDENT_DASHBOARD_BASE}/ai`}
            />
          </SectionCard>

          <SectionCard title="Achievement Progress" className="dash-panel">
            <AchievementPanel badges={gamification?.badges ?? []} nextBadge={gamification?.nextBadge} />
          </SectionCard>

          <SectionCard title="Activity Feed" className="dash-panel">
            <ActivityFeed items={gamification?.activityFeed ?? []} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export function StudentCalendar() {
  const { meetings, integrations, connectGoogle, disconnectGoogle, scheduleMeeting, events, profile, mentor } = useDashboardData();

  return (
    <div className="dash-page">
      <div className="dash-split dash-split--calendar">
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
        <SectionCard title="Schedule a meeting" className="dash-schedule-card">
          <ScheduleMeetingForm
            compact
            onSubmit={async (p) => {
              await scheduleMeeting({ ...p, status: "pending" });
            }}
          />
        </SectionCard>
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

export function StudentProfileStats() {
  const { profile } = useDashboardData();
  const [completion, setCompletion] = useState(profile?.profileCompletion ?? 62);

  return (
    <div className="dash-page">
      <SectionCard title="Profile completion">
        <ProgressBar label="Overall completion" value={completion} />
        <p className="dash-muted">Mentor: {profile?.mentorName || "—"}</p>
      </SectionCard>

      <form
        className="dash-profile-sections"
        onSubmit={(e) => {
          e.preventDefault();
          setCompletion(Math.min(100, completion + 6));
        }}
      >
        {PROFILE_SECTIONS.map((section) => (
          <SectionCard key={section.id} title={section.title}>
            {section.fields.map((label) => (
              <label key={label} className="prelude-field">
                <span>{label}</span>
                {section.textarea ? <textarea rows={3} /> : <input defaultValue={label === "Grade level" ? profile?.grade : label === "GPA" ? profile?.gpa : ""} />}
              </label>
            ))}
            <SecondaryButton type="button" className="dash-btn--sm">Edit</SecondaryButton>
          </SectionCard>
        ))}
        <PrimaryButton type="submit">Save profile</PrimaryButton>
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
  const { essays, tasks, extracurriculars, deadlines, applicationProgress: progress } = useDashboardData();
  const [tab, setTab] = useState("essays");
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

export function StudentMentor() {
  const { mentor, meetings, scheduleMeeting } = useDashboardData();
  const m = mentor;

  return (
    <div className="dash-page">
      <SectionCard className="dash-mentor-hero">
        <div className="dash-mentor-hero__head">
          <span className="dash-avatar dash-avatar--lg">{m.name?.[0]}</span>
          <div>
            <h2 className="dash-section-card__title">{m.name}</h2>
            <p className="dash-muted">{m.university} · {m.major} · Class of {m.graduationYear}</p>
          </div>
        </div>
        <p>{m.bio}</p>
        <div className="dash-tags">{m.expertise?.map((e) => <DashBadge key={e} variant="lavender">{e}</DashBadge>)}</div>
        <p className="dash-muted">Availability: {m.availability}</p>
        <div className="dash-mentor-hero__actions">
          <Link to={`${STUDENT_DASHBOARD_BASE}/messages`} className="dash-btn dash-btn--secondary">Send a message</Link>
        </div>
      </SectionCard>

      <div className="dash-split">
        <SectionCard title="Schedule a meeting">
          <ScheduleMeetingForm compact onSubmit={(p) => scheduleMeeting({ ...p, status: "pending" })} />
        </SectionCard>
        <SectionCard title="Upcoming meetings">
          {meetings.map((meet) => (
            <MeetingPreviewCard key={meet.id} meeting={meet} mentorName={m.name} role="student" />
          ))}
        </SectionCard>
      </div>
    </div>
  );
}

export function StudentMessages() {
  const { conversations, meetings } = useDashboardData();
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

export function StudentProfileSettings() {
  const { integrations, connectGoogle, disconnectGoogle, connectZoomAccount, disconnectZoomAccount } = useDashboardData();
  return (
    <div className="dash-page">
      <SectionCard title="Integrations">
        <IntegrationConnect label="Google Calendar" connectLabel="Connect Google Calendar" connected={integrations.googleCalendar?.connected} onConnect={connectGoogle} onDisconnect={disconnectGoogle} />
        <IntegrationConnect label="Zoom" connectLabel="Connect Zoom Account" connected={integrations.zoom?.connected} onConnect={connectZoomAccount} onDisconnect={disconnectZoomAccount} description="Required for virtual mentor meetings." />
      </SectionCard>
    </div>
  );
}
