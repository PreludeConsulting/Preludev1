import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  ListChecks,
  MapPin,
  Sparkles,
  Target,
  Users
} from "lucide-react";

const REWARD_ICONS = {
  "supplemental-essay-one": FileText,
  "supplemental-essay-college": FileText,
  "personal-statement-review": FileText,
  "activities-list-review": ListChecks,
  "activities-honors-review": ClipboardList,
  "college-list-review": MapPin,
  "student-resume-review": BookOpen,
  "scholarship-essay-review": FileText,
  "sat-act-help-session": Target,
  "academic-tutoring-session": GraduationCap,
  "two-mentor-personal-statement": Users,
  "full-written-application-one-college": Compass,
  "two-mentor-supplemental-one-college": Users,
  "complete-activities-honors-resume": ClipboardList,
  // Retired ids still render if history/modals reference them
  "essay-review-session": FileText,
  "quick-essay-feedback": FileText,
  "short-application-review": ListChecks,
  "test-prep-help": Target,
  "bonus-flexible-session": CalendarDays,
  "application-readiness-review": MapPin,
  "multi-mentor-review-package": Users,
  "major-career-fit": Compass
};

export default function RewardIcon({ reward, large = false, tier }) {
  const Icon = REWARD_ICONS[reward?.id] || Sparkles;
  const tone = reward?.iconTone || "purple";
  const tierClass = tier ? ` dash-rewards-reward-icon--tier-${tier}` : "";
  return (
    <span className={`dash-rewards-reward-icon dash-rewards-reward-icon--${tone}${tierClass}${large ? " dash-rewards-reward-icon--lg" : ""}`} aria-hidden="true">
      <Icon className={large ? "h-8 w-8" : "h-5 w-5"} />
    </span>
  );
}
