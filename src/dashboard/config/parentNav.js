import { LayoutDashboard, Calendar, Users } from "lucide-react";

export const PRODUCT_PARENT_NAV = [
  { to: "/overview", labelKey: "parentDashboard.nav.home", icon: LayoutDashboard, end: true },
  { to: "/children", labelKey: "parentDashboard.nav.myChildren", icon: Users }
];

export const PARENT_CHILD_NAV = [
  { to: "overview", labelKey: "parentDashboard.nav.summary", icon: LayoutDashboard, end: true },
  { to: "calendar", labelKey: "parentDashboard.nav.calendar", icon: Calendar }
];
