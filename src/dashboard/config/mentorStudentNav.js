import {
  Building2,
  Calendar,
  LayoutDashboard,
  Sparkles,
  TrendingUp
} from "lucide-react";

/** Sub-navigation when a mentor views a student's full dashboard. */
export const MENTOR_STUDENT_NAV = [
  { to: "overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "workspace", label: "Colleges", icon: Building2, workspaceTab: "colleges" },
  { to: "calendar", label: "Meetings", icon: Calendar },
  { to: "profile-stats", label: "Progress", icon: TrendingUp },
  { to: "ai", label: "Prelude AI", icon: Sparkles }
];
