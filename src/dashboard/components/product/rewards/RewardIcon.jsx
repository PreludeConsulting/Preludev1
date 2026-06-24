import {
  CalendarDays,
  Compass,
  FileText,
  ListChecks,
  MapPin,
  Mic,
  Sparkles,
  Target
} from "lucide-react";

const REWARD_ICONS = {
  "essay-review-session": FileText,
  "test-prep-help": Target,
  "college-list-review": MapPin,
  "activities-list-review": ListChecks,
  "application-strategy-call": CalendarDays,
  "major-career-fit": Compass,
  "mock-interview": Mic
};

export default function RewardIcon({ reward, large = false }) {
  const Icon = REWARD_ICONS[reward.id] || Sparkles;
  const tone = reward.iconTone || "purple";
  return (
    <span className={`dash-rewards-reward-icon dash-rewards-reward-icon--${tone}${large ? " dash-rewards-reward-icon--lg" : ""}`} aria-hidden="true">
      <Icon className={large ? "h-8 w-8" : "h-5 w-5"} />
    </span>
  );
}
