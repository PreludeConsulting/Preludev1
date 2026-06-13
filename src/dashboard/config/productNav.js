import {
  Building2,
  Calendar,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  TrendingUp
} from "lucide-react";

/** Primary top-nav tabs for the student product dashboard (Healthink-style). */
export const PRODUCT_STUDENT_NAV = [
  { to: "/overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/workspace", label: "Colleges", icon: Building2, workspaceTab: "colleges" },
  { to: "/calendar", label: "Meetings", icon: Calendar },
  { to: "/mentor", label: "My Mentor", icon: GraduationCap },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile-stats", label: "Progress", icon: TrendingUp }
];
