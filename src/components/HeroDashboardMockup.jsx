import {
  Bell,
  BookOpen,
  CheckSquare,
  CircleUser,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Search
} from "lucide-react";
import { DASHBOARD_COLLEGES } from "../data/universities.js";
import PreludeLogo from "./PreludeLogo.jsx";
import UniversityLogo from "./UniversityLogo.jsx";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Mentor", icon: GraduationCap },
  { label: "Tasks", icon: CheckSquare },
  { label: "Resources", icon: BookOpen },
  { label: "Finances", icon: DollarSign },
  { label: "Messages", icon: MessageCircle },
  { label: "Profile", icon: CircleUser }
];

export default function HeroDashboardMockup() {
  return (
    <div className="dashboard-mockup" aria-hidden="true">
      <div className="dashboard-mockup__shell">
        <header className="dashboard-mockup__topbar">
          <PreludeLogo className="prelude-logo--compact" />
          <div className="dashboard-mockup__topbar-actions">
            <Search className="h-4 w-4 opacity-50" />
            <Bell className="h-4 w-4 opacity-50" />
            <span className="dashboard-mockup__avatar">M</span>
          </div>
        </header>

        <div className="dashboard-mockup__body">
          <aside className="dashboard-mockup__sidebar">
            {navItems.map(({ label, icon: Icon, active }) => (
              <div
                className={`dashboard-mockup__nav-item ${active ? "dashboard-mockup__nav-item--active" : ""}`}
                key={label}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </aside>

          <div className="dashboard-mockup__main">
            <p className="dashboard-mockup__greeting">Welcome back, Maya! 👋</p>

            <div className="dashboard-mockup__card">
              <p className="dashboard-mockup__card-label">Next Mentor Session</p>
              <p className="dashboard-mockup__card-title">Essay Brainstorm with Stanford Mentor</p>
              <span className="dashboard-mockup__pill-btn">Join Session</span>
            </div>

            <div className="dashboard-mockup__card dashboard-mockup__card--compact">
              <div className="flex items-center justify-between gap-2">
                <p className="dashboard-mockup__card-label">Application Progress</p>
                <span className="dashboard-mockup__card-meta">7/12 Tasks</span>
              </div>
              <div className="dashboard-mockup__progress">
                <div className="dashboard-mockup__progress-fill" style={{ width: "58%" }} />
              </div>
            </div>

            <div>
              <p className="dashboard-mockup__section-label">My Colleges</p>
              <div className="dashboard-mockup__colleges">
                {DASHBOARD_COLLEGES.map((school) => (
                  <div className="dashboard-mockup__college" key={school.id}>
                    <UniversityLogo school={school} className="dashboard-mockup__college-logo" />
                    <span className="dashboard-mockup__college-name">{school.shortName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-mockup__ai-bubble">
        <span>Need help? Ask Prelude AI</span>
      </div>
    </div>
  );
}
