import { Mail } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { Avatar, DashBadge, SectionCard } from "../ui/index.jsx";

export default function SettingsPageShell({
  user,
  roleLabel,
  planName,
  tabs,
  activeTab,
  onTabChange,
  onOpenAccount,
  children
}) {
  const active = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  return (
    <div className="dash-page dash-page--premium dash-settings-page">
      <SectionCard className="dash-settings-id dash-panel" padding={false}>
        <div className="dash-settings-id__inner">
          <Avatar name={user?.name} size="lg" />
          <div className="dash-settings-id__text">
            <h2 className="dash-settings-id__name">{user?.name || "Your account"}</h2>
            <p className="dash-settings-id__email">
              <Mail className="h-4 w-4" aria-hidden="true" /> {user?.email || "—"}
            </p>
            <div className="dash-settings-id__badges">
              <DashBadge variant="soft">{roleLabel}</DashBadge>
              <DashBadge variant="lavender">{planName} plan</DashBadge>
            </div>
          </div>
          {onOpenAccount ? (
            <button type="button" className="dash-btn dash-btn--secondary dash-btn--sm" onClick={onOpenAccount}>
              Account &amp; plan
            </button>
          ) : null}
        </div>
      </SectionCard>

      <div className="dash-settings-page__body">
        <nav className="dash-settings-page__tabs" aria-label="Settings sections">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                type="button"
                className={cn("dash-settings-tab", isActive && "dash-settings-tab--active")}
                onClick={() => onTabChange(tab.id)}
                aria-current={isActive ? "true" : undefined}
              >
                {Icon ? <Icon className="dash-settings-tab__icon" aria-hidden="true" /> : null}
                <span className="dash-settings-tab__label">{tab.label}</span>
                {tab.description ? (
                  <span className="dash-settings-tab__desc">{tab.description}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div
          className="dash-settings-page__content"
          role="tabpanel"
          aria-labelledby={`settings-tab-${active?.id}`}
        >
          <header className="dash-settings-page__content-head">
            <h3 className="dash-settings-page__content-title">{active?.label}</h3>
            {active?.description ? (
              <p className="dash-settings-page__content-sub">{active.description}</p>
            ) : null}
          </header>
          <div className="dash-settings-page__panels">{children}</div>
        </div>
      </div>
    </div>
  );
}
