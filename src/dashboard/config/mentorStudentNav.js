import {
  Bot,
  Building2,
  Calendar,
  LayoutDashboard,
  Sparkles
} from "lucide-react";
import { isPreludeAiEnabled } from "../../lib/preludeAi.js";

/** Sub-navigation when a mentor views a student's full dashboard. */
export const MENTOR_STUDENT_NAV = [
  { to: "overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "workspace", label: "Colleges", icon: Building2, workspaceTab: "colleges" },
  { to: "calendar", label: "Meetings", icon: Calendar },
  { to: "progress-rewards", label: "Progress Rewards", icon: Sparkles },
  ...(isPreludeAiEnabled() ? [{ to: "ai", label: "Prelude AI", icon: Bot }] : [])
];
