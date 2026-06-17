import { CalendarPlus } from "lucide-react";

const EXAMPLE_UPDATE = {
  title: "Jordan requested a Zoom check-in",
  date: "Tomorrow at 4:00 PM"
};

export default function MentorMeetingsLiveSection() {
  return (
    <section className="dash-mentor-live" aria-labelledby="mentor-meetings-live-heading">
      <div className="dash-mentor-live__head">
        <div className="dash-mentor-live__title-row">
          <h2 id="mentor-meetings-live-heading" className="dash-mentor-live__title">
            Live updates for your students
          </h2>
          <span className="dash-mentor-live__badge">
            <span className="dash-mentor-live__badge-dot" aria-hidden="true" />
            Live
          </span>
        </div>
        <p className="dash-mentor-live__copy">
          Schedule meetings, approve student requests, and keep each student&apos;s calendar aligned with their admissions priorities.
        </p>
      </div>

      <article className="dash-mentor-live__card">
        <div className="dash-mentor-live__card-icon" aria-hidden="true">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div className="dash-mentor-live__card-body">
          <p className="dash-mentor-live__card-label">New request</p>
          <p className="dash-mentor-live__card-title">
            {EXAMPLE_UPDATE.title} — {EXAMPLE_UPDATE.date}
          </p>
        </div>
      </article>
    </section>
  );
}
