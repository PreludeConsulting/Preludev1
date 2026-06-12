import { CalendarPlus } from "lucide-react";

const EXAMPLE_UPDATE = {
  title: "Mentor added: Georgia Tech essay deadline",
  date: "June 28"
};

export default function MentorLiveUpdatesSection() {
  return (
    <section className="dash-mentor-live" aria-labelledby="mentor-live-heading">
      <div className="dash-mentor-live__head">
        <div className="dash-mentor-live__title-row">
          <h2 id="mentor-live-heading" className="dash-mentor-live__title">
            Live updates from your mentor
          </h2>
          <span className="dash-mentor-live__badge">
            <span className="dash-mentor-live__badge-dot" aria-hidden="true" />
            Live
          </span>
        </div>
        <p className="dash-mentor-live__copy">
          Your mentor actively manages your calendar, scheduling meetings, updating priorities, adding new opportunities, and removing completed tasks to keep you focused on what matters most.
        </p>
      </div>

      <article className="dash-mentor-live__card">
        <div className="dash-mentor-live__card-icon" aria-hidden="true">
          <CalendarPlus className="h-4 w-4" />
        </div>
        <div className="dash-mentor-live__card-body">
          <p className="dash-mentor-live__card-label">Mentor added</p>
          <p className="dash-mentor-live__card-title">
            {EXAMPLE_UPDATE.title} — {EXAMPLE_UPDATE.date}
          </p>
        </div>
      </article>
    </section>
  );
}
