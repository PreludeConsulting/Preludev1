import {
  BookOpen,
  CircleUser,
  Compass,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Map,
  MessageCircle
} from "lucide-react";
import { cn } from "../../lib/utils.js";
import { HERO_SIDEBAR_ITEMS } from "../../data/heroMentorMatch.js";

const ICONS = {
  layout: LayoutDashboard,
  match: GraduationCap,
  roadmap: Map,
  book: BookOpen,
  dollar: DollarSign,
  message: MessageCircle,
  user: CircleUser
};

export default function DashboardSidebar({ compact = false }) {
  return (
    <nav className={cn("hero-mm-sidebar", compact && "hero-mm-sidebar--compact")} aria-label="Dashboard sections">
      {HERO_SIDEBAR_ITEMS.map(({ id, label, icon, active }) => {
        const Icon = ICONS[icon] ?? Compass;
        return (
          <button
            key={id}
            type="button"
            className={cn("hero-mm-sidebar__item", active && "hero-mm-sidebar__item--active")}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!compact ? <span>{label}</span> : <span className="sr-only">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
