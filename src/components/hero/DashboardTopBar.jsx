import { Bell, Search } from "lucide-react";
import PreludeLogo from "../PreludeLogo.jsx";
import PreludePigAvatar from "./PreludePigAvatar.jsx";

export default function DashboardTopBar({ reducedMotion }) {
  return (
    <header className="hero-mm-topbar">
      <div className="hero-mm-topbar__brand">
        <PreludeLogo className="prelude-logo--compact" />
        <div className="hero-mm-topbar__ai">
          <PreludePigAvatar size="xs" reducedMotion={reducedMotion} label="" />
          <div>
            <p className="hero-mm-topbar__title">Prelude AI</p>
            <p className="hero-mm-topbar__status">
              <span className="hero-mm-online" aria-hidden="true" />
              Finding your best path
            </p>
          </div>
        </div>
      </div>
      <div className="hero-mm-topbar__actions">
        <button type="button" className="hero-mm-icon-btn" aria-label="Search dashboard">
          <Search className="h-4 w-4" />
        </button>
        <button type="button" className="hero-mm-icon-btn" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </button>
        <span className="hero-mm-topbar__student" aria-label="Student profile">
          S
        </span>
      </div>
    </header>
  );
}
