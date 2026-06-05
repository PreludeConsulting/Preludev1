import {
  Bot,
  Briefcase,
  Calendar,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  Users
} from "lucide-react";

export const STUDENT_NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/ai", label: "Prelude AI", icon: Bot },
  { to: "/profile-stats", label: "My Profile", icon: User },
  { to: "/workspace", label: "Application Workspace", icon: ClipboardList },
  { to: "/mentor", label: "My Mentor", icon: GraduationCap },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Settings", icon: Settings }
];

export const MENTOR_NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/students", label: "Students", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/availability", label: "Availability", icon: Briefcase },
  { to: "/profile", label: "Mentor Profile", icon: User }
];
