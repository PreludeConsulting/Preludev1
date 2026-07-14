import { SectionCard } from "../ui/index.jsx";

/** Temporary placeholder while application component reviews are offline. */
export default function StudentApplicationReviewsPanel() {
  return (
    <SectionCard className="dash-panel dash-application-reviews dash-application-reviews--maintenance">
      <p className="dash-application-reviews__maintenance-message">
        Maintenance. Additions will be done soon.
      </p>
    </SectionCard>
  );
}
