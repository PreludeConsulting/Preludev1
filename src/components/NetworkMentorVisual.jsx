import { Sparkles } from "lucide-react";
import { DASHBOARD_COLLEGES } from "../data/universities.js";
import UniversityLogo from "./UniversityLogo.jsx";

const MAJOR_TAGS = ["Business", "CS", "Biology", "Engineering"];

const MENTOR_PROFILES = [
  {
    initials: "JL",
    name: "Jordan L.",
    schoolId: "stanford",
    major: "Computer Science",
    match: "96% match"
  },
  {
    initials: "AM",
    name: "Aisha M.",
    schoolId: "mit",
    major: "Biology",
    match: "94% match"
  },
  {
    initials: "RK",
    name: "Riley K.",
    schoolId: "upenn",
    major: "Business",
    match: "92% match"
  }
];

const schoolById = Object.fromEntries(DASHBOARD_COLLEGES.map((s) => [s.id, s]));

export default function NetworkMentorVisual() {
  return (
    <div className="network-visual" aria-hidden="true">
      <div className="network-visual__frame">
        <svg className="network-visual__mesh" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="network-mesh-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(267 86% 48% / 0.35)" />
              <stop offset="100%" stopColor="hsl(267 86% 48% / 0.08)" />
            </linearGradient>
          </defs>
          <circle cx="72" cy="88" r="4" fill="hsl(267 86% 48% / 0.35)" />
          <circle cx="200" cy="56" r="4" fill="hsl(267 86% 48% / 0.28)" />
          <circle cx="328" cy="104" r="4" fill="hsl(267 86% 48% / 0.32)" />
          <circle cx="120" cy="200" r="4" fill="hsl(267 86% 48% / 0.22)" />
          <circle cx="280" cy="220" r="4" fill="hsl(267 86% 48% / 0.3)" />
          <circle cx="200" cy="168" r="5" fill="hsl(267 86% 48% / 0.45)" />
          <path
            d="M72 88 L200 56 L328 104 M200 56 L200 168 M328 104 L200 168 M72 88 L120 200 L200 168 M280 220 L200 168"
            fill="none"
            stroke="url(#network-mesh-line)"
            strokeWidth="1.25"
            strokeDasharray="4 6"
          />
        </svg>

        <div className="network-visual__panel">
          <header className="network-visual__header">
            <span className="network-visual__header-icon">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="network-visual__eyebrow">PreludeMatch</p>
              <h3 className="network-visual__title">Mentor Network</h3>
            </div>
            <span className="network-visual__live">Live</span>
          </header>

          <div className="network-visual__tags">
            {MAJOR_TAGS.map((tag) => (
              <span className="network-visual__tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <ul className="network-visual__mentors">
            {MENTOR_PROFILES.map((mentor) => {
              const school = schoolById[mentor.schoolId];
              return (
                <li className="network-visual__mentor" key={mentor.name}>
                  <span className="network-visual__avatar">{mentor.initials}</span>
                  <div className="network-visual__mentor-body">
                    <div className="network-visual__mentor-top">
                      <span className="network-visual__mentor-name">{mentor.name}</span>
                      <span className="network-visual__mentor-match">{mentor.match}</span>
                    </div>
                    <div className="network-visual__mentor-meta">
                      {school ? (
                        <UniversityLogo school={school} className="network-visual__school-logo" />
                      ) : null}
                      <span>{mentor.major}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="network-visual__schools">
            <span className="network-visual__schools-label">Universities in network</span>
            <div className="network-visual__schools-row">
              {DASHBOARD_COLLEGES.map((school) => (
                <UniversityLogo school={school} className="network-visual__school-logo" key={school.id} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
