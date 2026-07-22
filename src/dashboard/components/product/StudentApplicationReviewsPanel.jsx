import { FileCheck2 } from "lucide-react";
import { EmptyState, SectionCard } from "../ui/index.jsx";

export default function StudentApplicationReviewsPanel() {
  return (
    <SectionCard title="Application reviews" className="dash-panel dash-application-reviews">
      <EmptyState
        icon={FileCheck2}
        title="No application reviews yet"
        description="Completed mentor reviews will appear here after you submit application materials for feedback."
      />
    </SectionCard>
  );
}
