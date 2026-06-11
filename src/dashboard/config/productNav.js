import {
  Calendar,
  LayoutDashboard,
  MessageCircle,
  Search,
  Settings
} from "lucide-react";

/** Primary top-nav tabs — keep compact; full list lives in mobile overflow (STUDENT_NAV). */
export const PRODUCT_STUDENT_NAV = [
  { to: "/overview", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/prelude-match", label: "Prelude Match", icon: Search },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/settings", label: "Settings", icon: Settings }
];
