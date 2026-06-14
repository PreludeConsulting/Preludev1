import PlanBadge from "./PlanBadge.jsx";

export default function MembershipPlanCard({ plan, planId }) {
  return (
    <div className="membership-plan-card">
      <div className="membership-plan-card__head">
        <span className="membership-plan-card__label">Membership Plan</span>
        <PlanBadge planId={planId} />
      </div>
      <p className="membership-plan-card__name">{plan.name}</p>
      <p className="membership-plan-card__summary">{plan.tagline}</p>
      <a href="#pricing" className="membership-plan-card__link">
        View plans
      </a>
    </div>
  );
}
