import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Check,
  Flame,
  MessageCircle,
  Sparkles,
  Target,
  TrendingUp,
  Video,
  Zap
} from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { Avatar, DashBadge, PrimaryButton, SecondaryButton, ViewAllLink } from "./index.jsx";

export function LevelBadge({ level, name }) {
  return (
    <span className="dash-level-badge">
      <Sparkles className="h-3.5 w-3.5" />
      Lv {level} · {name}
    </span>
  );
}

export function XPProgressBar({ xp, levelInfo, className }) {
  const pct = levelInfo?.progress ?? 0;
  return (
    <div className={cn("dash-xp-bar", className)}>
      <div className="dash-xp-bar__meta">
        <span className="dash-xp-bar__label">
          <Zap className="h-3.5 w-3.5" /> {xp} XP
        </span>
        {levelInfo?.next ? (
          <span className="dash-xp-bar__next">{levelInfo.xpToNext - levelInfo.xpInLevel} to Lv {levelInfo.next.level}</span>
        ) : (
          <span className="dash-xp-bar__next">Max level</span>
        )}
      </div>
      <div className="dash-xp-bar__track">
        <span className="dash-xp-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function formatOrdinal(value) {
  const num = Math.round(Number(value) || 0);
  const mod100 = num % 100;
  const mod10 = num % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
}

function ProgressRingSvg({ value, size }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="dash-ring__bg" cx={size / 2} cy={size / 2} r={r} />
      <circle
        className="dash-ring__fg"
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function ProgressRing({ value, size = 44, label }) {
  return (
    <div className="dash-ring" style={{ width: size, height: size }} title={label}>
      <ProgressRingSvg value={value} size={size} />
      <span className="dash-ring__value">{value}%</span>
    </div>
  );
}

export function MissionCard({ mission, onToggle }) {
  return (
    <label className={cn("dash-mission", mission.done && "dash-mission--done")}>
      <input type="checkbox" checked={mission.done} onChange={() => !mission.done && onToggle?.(mission.id)} />
      <div className="dash-mission__body">
        <p className="dash-mission__title">{mission.title}</p>
        <div className="dash-mission__meta">
          <DashBadge variant={mission.priority === "high" ? "urgent" : "soft"}>{mission.priority}</DashBadge>
          {mission.due ? <span className="dash-mission__due">{mission.due}</span> : null}
        </div>
      </div>
      <span className="dash-mission__xp">+{mission.xp} XP</span>
    </label>
  );
}

export function AchievementBadge({ badge, locked }) {
  return (
    <div className={cn("dash-achievement", locked && "dash-achievement--locked")} title={badge.desc}>
      <Award className="h-4 w-4" />
      <span>{badge.name}</span>
    </div>
  );
}

export function ActivityFeed({ items = [] }) {
  const iconFor = (type) => {
    if (type === "xp") return Zap;
    if (type === "meeting") return Video;
    if (type === "essay") return Target;
    if (type === "college") return TrendingUp;
    return Check;
  };
  return (
    <ul className="dash-activity-feed">
      {items.map((item) => {
        const Icon = iconFor(item.type);
        return (
          <li key={item.id} className="dash-activity-feed__item">
            <span className="dash-activity-feed__icon">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="dash-activity-feed__text">{item.text}</p>
              <p className="dash-activity-feed__sub">{item.sub}</p>
            </div>
            <time>{item.time}</time>
          </li>
        );
      })}
    </ul>
  );
}

export function StudentProgressCard({ student, basePath, needsAttention }) {
  const g = student.gamification || {};
  const lvl = g.level || { level: 1, name: "Getting Started" };
  return (
    <article className={cn("dash-progress-card", needsAttention && "dash-progress-card--alert")}>
      <div className="dash-progress-card__head">
        <Avatar name={student.name} size="lg" />
        <div className="dash-progress-card__info">
          <h3>{student.name}</h3>
          <p>{student.grade} · {student.major}</p>
        </div>
        {needsAttention ? <DashBadge variant="urgent">Needs attention</DashBadge> : null}
      </div>
      <div className="dash-progress-card__metrics">
        <ProgressRing value={student.profileCompletion} size={40} />
        <div className="dash-progress-card__stats">
          <span><Flame className="h-3.5 w-3.5" /> {g.streak ?? 0}d streak</span>
          <span>Lv {lvl.level ?? 1} · {g.xp ?? 0} XP</span>
        </div>
      </div>
      <div className="dash-progress-card__facts">
        <span>Next: {student.nextMeeting}</span>
        <span>{student.upcomingDeadlines} deadlines</span>
      </div>
      <Link to={`${basePath}/students/${student.id}/overview`} className="dash-btn dash-btn--secondary dash-btn--sm">
        View Student
      </Link>
    </article>
  );
}

export function OverviewHero({ title, welcome, levelInfo, xp, streak, actions, gamified = false }) {
  return (
    <header className="dash-hero">
      <div className="dash-hero__main">
        <h1 className="dash-hero__title shopify-hero__headline">{title}</h1>
        <p className="dash-hero__welcome">{welcome}</p>
        {gamified ? (
          <div className="dash-hero__gamification">
            <LevelBadge level={levelInfo.level} name={levelInfo.name} />
            <span className="dash-hero__streak">
              <Flame className="h-4 w-4" /> {streak}-day streak
            </span>
            <XPProgressBar xp={xp} levelInfo={levelInfo} className="dash-hero__xp" />
          </div>
        ) : null}
      </div>
      {actions ? <div className="dash-hero__actions">{actions}</div> : null}
    </header>
  );
}

export function CompactStatCard({ icon: Icon, label, value, trend, progress }) {
  return (
    <article className="dash-metric-card">
      <div className="dash-metric-card__icon">{Icon ? <Icon className="h-4 w-4" /> : null}</div>
      <div>
        <p className="dash-metric-card__value">{value}</p>
        <p className="dash-metric-card__label">{label}</p>
        {progress != null ? (
          <div className="dash-metric-card__track">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
      {trend ? <DashBadge variant="soft">{trend}</DashBadge> : null}
    </article>
  );
}

export function MeetingCardPremium({ meeting, mentorName, studentName, role, messagePath }) {
  const start = new Date(meeting.startTime);
  const name = mentorName || studentName;
  const showZoom = meeting.meetingType === "zoom" && meeting.zoomJoinUrl;
  return (
    <article className="dash-meeting-card-premium">
      <div className="dash-meeting-card-premium__head">
        <Avatar name={name} size="lg" />
        <div>
          <p className="dash-meeting-card-premium__title">{meeting.title}</p>
          <p className="dash-meeting-card-premium__with">{role === "student" ? `with ${mentorName}` : `with ${studentName}`}</p>
        </div>
        <DashBadge variant="zoom">Zoom</DashBadge>
      </div>
      <p className="dash-meeting-card-premium__time">
        {start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
        {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </p>
      <div className="dash-meeting-card-premium__actions">
        {showZoom ? (
          <a href={meeting.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn--primary dash-btn--sm">
            <Video className="h-4 w-4" /> Join Zoom
          </a>
        ) : null}
        {messagePath ? (
          <Link to={messagePath} className="dash-btn dash-btn--secondary dash-btn--sm">
            <MessageCircle className="h-4 w-4" /> Message
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function InsightList({ items, actionLink, actionLabel = "Open Prelude AI", layout = "default" }) {
  return (
    <div className={cn("dash-insights", layout === "wide" && "dash-insights--wide")}>
      <ul>
        {items.slice(0, layout === "wide" ? 5 : 4).map((text) => (
          <li key={text}>
            <Sparkles className="h-3.5 w-3.5" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {actionLink ? (
        <Link to={actionLink} className="dash-btn dash-btn--secondary dash-btn--sm">{actionLabel}</Link>
      ) : null}
    </div>
  );
}

export function AchievementPanel({ badges, nextBadge }) {
  return (
    <div className="dash-achievements-panel">
      <div className="dash-achievements-panel__row">
        {badges.slice(0, 3).map((b) => (
          <AchievementBadge key={b.id} badge={b} />
        ))}
      </div>
      {nextBadge ? (
        <>
          <div className="dash-achievements-panel__next">
            <span>Next: {nextBadge.name}</span>
            <span>{nextBadge.progress}%</span>
          </div>
          <div className="dash-progress-row__track">
            <span style={{ width: `${nextBadge.progress}%` }} />
          </div>
        </>
      ) : null}
      <ViewAllLink to="#">View achievements</ViewAllLink>
    </div>
  );
}

export function MentorMissionAssign({ onAdd }) {
  const [title, setTitle] = useState("");
  const [xp, setXp] = useState(40);
  return (
    <form
      className="dash-mentor-mission-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd?.({ title: title.trim(), xp, due: "Friday" });
        setTitle("");
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom mission for student…" />
      <input type="number" min={10} max={100} value={xp} onChange={(e) => setXp(Number(e.target.value))} />
      <PrimaryButton type="submit" className="dash-btn--sm">Assign</PrimaryButton>
    </form>
  );
}
