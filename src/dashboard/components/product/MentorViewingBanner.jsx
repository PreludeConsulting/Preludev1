import { Calendar, Eye } from "lucide-react";

export default function MentorViewingBanner({ student }) {
  if (!student) return null;

  const possessiveName = student.name?.endsWith("s")
    ? `${student.name}'`
    : `${student.name}'s`;
  const planLabel = student.planLabel || null;
  const paymentTypeLabel =
    student.paymentType === "one_time"
      ? "One-time"
      : student.paymentType === "recurring"
        ? "Recurring"
        : null;
  const usageSummary = student.usageSummary || null;

  return (
    <div className="dash-mentor-viewing-banner" role="region" aria-label="Mentor viewing mode">
      <div className="dash-mentor-viewing-banner__left">
        <div className="dash-mentor-viewing-banner__icon" aria-hidden="true">
          <Eye className="h-5 w-5" />
        </div>
        <div className="dash-mentor-viewing-banner__text">
          <h2 className="dash-mentor-viewing-banner__title">
            Viewing {possessiveName} Dashboard as Mentor
          </h2>
          <p className="dash-mentor-viewing-banner__subtitle">
            You can edit calendar events and complete eligible Progress Rewards tasks for this student. Coins are added only after the student claims.
          </p>
          {planLabel || usageSummary ? (
            <p className="dash-mentor-viewing-banner__plan">
              {[planLabel, paymentTypeLabel, usageSummary].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="dash-mentor-viewing-banner__status">
        <Calendar className="h-4 w-4" aria-hidden="true" />
        <span>Calendar Editing Enabled</span>
      </div>
    </div>
  );
}
