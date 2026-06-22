import { LayoutDashboard, Calendar, Users } from "lucide-react";

export const PRODUCT_PARENT_NAV = [
  { to: "/overview", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/children", label: "My Children", icon: Users }
];

export const PARENT_CHILD_NAV = [
  { to: "overview", label: "Summary", icon: LayoutDashboard, end: true },
  { to: "calendar", label: "Calendar", icon: Calendar }
];
