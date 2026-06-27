import {
  CalendarDays,
  Clock,
  Compass,
  FileText,
  ListChecks,
  MapPin,
  Mic,
  Search,
  Sparkles,
  Target,
  Users
} from "lucide-react";

const REWARD_ICONS = {
  "essay-review-session": FileText,
  "test-prep-help": Target,
  "college-list-review": MapPin,
  "activities-list-review": ListChecks,
  "application-strategy-call": CalendarDays,
  "major-career-fit": Compass,
  "mock-interview": Mic,
  "scholarship-search": Search,
  "parent-strategy-call": Users,
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
