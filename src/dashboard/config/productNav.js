import {
  Building2,
  Calendar,
  FileText,
  LayoutDashboard,
  TrendingUp
} from "lucide-react";

/** Primary top-nav tabs for the student product dashboard (Healthink-style). */
export const PRODUCT_STUDENT_NAV = [
  { to: "/overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/workspace", label: "Colleges", icon: Building2, workspaceTab: "colleges" },
  { to: "/workspace", label: "Essays", icon: FileText, workspaceTab: "essays" },
  { to: "/calendar", label: "Meetings", icon: Calendar },
  { to: "/profile-stats", label: "Progress", icon: TrendingUp }
];
