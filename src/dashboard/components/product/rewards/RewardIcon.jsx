import {
  CalendarDays,
  Clock,
  Compass,
  FileText,
  ListChecks,
  MapPin,
  Mic,
  Sparkles,
  Target,
  Users
} from "lucide-react";

const REWARD_ICONS = {
  "essay-review-session": FileText,
  "quick-essay-feedback": FileText,
  "short-application-review": ListChecks,
  "test-prep-help": Target,
  "bonus-flexible-session": CalendarDays,
  "application-readiness-review": MapPin,
  "multi-mentor-review-package": Users,
  "major-career-fit": Compass,
  "mock-interview": Mic,
  "priority-office-hours": Clock
};

export default function RewardIcon({ reward, large = false, tier }) {
  const Icon = REWARD_ICONS[reward.id] || Sparkles;
  const tone = reward.iconTone || "purple";
  const tierClass = tier ? ` dash-rewards-reward-icon--tier-${tier}` : "";
  return (
    <span className={`dash-rewards-reward-icon dash-rewards-reward-icon--${tone}${tierClass}${large ? " dash-rewards-reward-icon--lg" : ""}`} aria-hidden="true">
      <Icon className={large ? "h-8 w-8" : "h-5 w-5"} />
    </span>
  );
}
