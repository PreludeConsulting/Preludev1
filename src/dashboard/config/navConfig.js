import {
  Bot,
  Briefcase,
  Calendar,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings
} from "lucide-react";

export const STUDENT_NAV = [
  { to: "/overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/prelude-match", label: "Prelude Match", icon: Search },
  { to: "/mentor", label: "My Mentors", icon: GraduationCap },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/ai", label: "Prelude AI", icon: Bot },
  { to: "/workspace", label: "Application Workspace", icon: ClipboardList }
];

export const MENTOR_NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Meetings", icon: Calendar },
  { to: "/students", label: "Students", icon: Search },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/availability", label: "Availability", icon: Briefcase },
  { to: "/settings", label: "Settings", icon: Settings }
];
