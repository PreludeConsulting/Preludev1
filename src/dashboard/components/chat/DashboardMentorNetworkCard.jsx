import { useEffect, useState } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { getInitials } from "../../../lib/avatar.js";
import { pickMentorNetworkCardTags } from "../../../lib/mentorNetworkCardTags.js";
import { cn } from "../../../lib/utils.js";

function resolveMentorPhoto(mentor) {
  return mentor.photo || mentor.avatarUrl || mentor.avatar_url || mentor.image || null;
}

export function resolveMentorBio(mentor) {
  return mentor.bio || mentor.reason || mentor.description || "";
}

function resolveMentorTags(mentor) {
  return pickMentorNetworkCardTags(mentor);
}

function resolveMentorSchool(mentor) {
  return mentor.school || mentor.university || "";
}

function resolveMentorTargets(mentor) {
  const targets = Array.isArray(mentor.targets)
    ? mentor.targets
    : Array.isArray(mentor.targetMajors)
      ? mentor.targetMajors
      : [];
  return targets.filter(Boolean);
}

function resolveMentorInitials(mentor) {
  if (mentor.initials) return mentor.initials;
  return getInitials(mentor.name, "M");
}

function MentorNetworkCardMedia({ mentor }) {
  const photo = resolveMentorPhoto(mentor);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [photo]);

  return (
    <div className="dash-chat-network-card__media">
      {photo && !imageFailed ? (
        <img
          src={photo}
          alt=""
          className="dash-chat-network-card__photo"
          style={mentor.objectPosition ? { objectPosition: mentor.objectPosition } : undefined}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="dash-chat-network-card__initials" aria-hidden="true">
          {resolveMentorInitials(mentor)}
        </div>
      )}
    </div>
  );
}

export function mentorMatchesQuery(mentor, needle) {
  if (!needle) return true;
  const hay = [
    mentor.name,
    resolveMentorSchool(mentor),
    mentor.major,
    resolveMentorBio(mentor),
    mentor.availability,
    ...resolveMentorTargets(mentor),
    ...(mentor.specialties || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export default function DashboardMentorNetworkCard({
  mentor,
  onViewProfile,
  locked = false,
  expanded = false,
  className
}) {
  const tags = resolveMentorTags(mentor);
  const school = resolveMentorSchool(mentor);
  const schoolLine = [school, mentor.major].filter(Boolean).join(" | ");
  const nextOpening = mentor.nextOpening || "";

  const card = (
    <article className={cn("dash-chat-network-card", expanded && "dash-chat-network-card--expanded", className)}>
      <MentorNetworkCardMedia mentor={mentor} />

      <div className="dash-chat-network-card__body">
        <div className="dash-chat-network-card__identity">
          <h3 className="dash-chat-network-card__name">{mentor.name}</h3>
          {schoolLine ? <p className="dash-chat-network-card__school">{schoolLine}</p> : null}
        </div>

        {expanded && tags.length ? (
          <div className="dash-chat-network-card__tags" aria-label="Specialties">
            {tags.map((tag) => (
              <span key={tag} className="dash-chat-network-card__tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="dash-chat-network-card__fact">
          <span className="dash-chat-network-card__fact-label">Next Opening</span>
          <span className="dash-chat-network-card__fact-value dash-chat-network-card__fact-value--accent">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {nextOpening || "No availability listed"}
          </span>
        </div>

        {onViewProfile ? (
          <span className="dash-chat-network-card__cta">
            View profile
            {locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          </span>
        ) : null}
      </div>
    </article>
  );

  if (!onViewProfile) return card;

  return (
    <button
      type="button"
      className="dash-chat-network-card__btn"
      onClick={onViewProfile}
      aria-label={`View profile for ${mentor.name}`}
    >
      {card}
    </button>
  );
}
