export default function DashboardCard({ title, value, hint, children, className = "", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`dash-card paper-card ${onClick ? "dash-card--clickable" : ""} ${className}`.trim()}
      onClick={onClick}
    >
      {title ? <p className="dash-card__label">{title}</p> : null}
      {value ? <p className="dash-card__value">{value}</p> : null}
      {hint ? <p className="dash-card__hint">{hint}</p> : null}
      {children}
    </Tag>
  );
}
