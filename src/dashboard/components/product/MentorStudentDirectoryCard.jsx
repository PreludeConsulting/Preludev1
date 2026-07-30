import { Link } from "react-router";
import { Calendar, ChevronRight, Flame, MoreVertical, Plus } from "lucide-react";
import { Avatar, IconButton } from "../ui/index.jsx";
import { ProgressRing } from "../ui/gamification.jsx";

export default function MentorStudentDirectoryCard({ student, basePath, onAssign }) {
  const streak = student.gamification?.streak ?? 0;
  const profileStrength = student.profileCompletion ?? 0;
  const nextDeadline = student.nextMeeting || student.nextDeadline || "TBD";
  const deadlineCount = student.upcomingDeadlines ?? 0;
  const planLabel = student.planLabel || null;
  const usageSummary = student.usageSummary
    || (student.reviewCredits
      ? `${student.reviewCredits.remaining} review credits remaining`
      : student.sessionAllowance
        ? `${student.sessionAllowance.remaining} of ${student.sessionAllowance.included} sessions remaining`
        : null);

  return (
    <article className="dash-mentor-directory-card">
      <div className="dash-mentor-directory-card__head">
        <Avatar name={student.name} avatarUrl={student.avatarUrl} size="lg" />
        <div className="dash-mentor-directory-card__identity">
          <h3 className="dash-mentor-directory-card__name">{student.displayName || student.name}</h3>
          <p className="dash-mentor-directory-card__meta">
            {student.grade} Grade
            {planLabel ? ` · ${planLabel}` : ""}
          </p>
          {planLabel ? (
            <span className={`dash-mentor-directory-card__plan dash-mentor-directory-card__plan--${String(student.plan || "basic").toLowerCase()}`}>
              {planLabel}
            </span>
          ) : null}
          {usageSummary ? (
            <p className="dash-mentor-directory-card__usage">{usageSummary}</p>
          ) : null}
        </div>
        <IconButton label={`More options for ${student.displayName || student.name}`} className="dash-mentor-directory-card__menu">
          <MoreVertical className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="dash-mentor-directory-card__divider" role="separator" aria-hidden="true" />

      <div className="dash-mentor-directory-card__profile">
        <ProgressRing value={profileStrength} size={72} />
        <div className="dash-mentor-directory-card__profile-copy">
          <p className="dash-mentor-directory-card__strength">
            <strong>{profileStrength}%</strong> Profile Strength
          </p>
          <p className="dash-mentor-directory-card__streak">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {streak} day streak
          </p>
        </div>
      </div>

      <div className="dash-mentor-directory-card__divider" role="separator" aria-hidden="true" />

      <div className="dash-mentor-directory-card__deadlines">
        <div className="dash-mentor-directory-card__deadline-label-row">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          <span className="dash-mentor-directory-card__deadline-label">Next Deadline</span>
        </div>
        <p className="dash-mentor-directory-card__deadline-date">{nextDeadline}</p>
        <p className="dash-mentor-directory-card__deadline-count">
          {deadlineCount} deadline{deadlineCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="dash-mentor-directory-card__footer">
        <button
          type="button"
          className="dash-btn dash-btn--primary dash-mentor-directory-card__cta"
          onClick={() => onAssign?.(student)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Assign Activity</span>
        </button>
        <Link
          to={`${basePath}/students/${student.id}/overview`}
          className="dash-btn dash-btn--secondary dash-mentor-directory-card__cta"
        >
          <span>View Student</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
