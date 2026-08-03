import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { useAuth } from "../../../context/AuthContext.jsx";
import { PlanWalletExperience } from "../../../components/PlanSelectionPage.jsx";
import { STUDENT_BILLING_PATH } from "../../../../shared/stripePaymentLinks.js";
import { Navigate } from "react-router";

/**
 * Logged-in plan wallet for existing customers (Plus/Pro switch + Essay Support).
 * Does not restart onboarding.
 */
export default function StudentBillingPlansPage() {
  const { user, ready } = useAuth();
  const [searchParams] = useSearchParams();
  const selection = searchParams.get("selection");
  const initialWalletOpen =
    searchParams.get("wallet") === "open" ||
    selection === "essay-support" ||
    Boolean(searchParams.get("bundle"));

  if (!ready) {
    return <div className="dash-loading">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: STUDENT_BILLING_PATH + "/plans" }} />;
  }

  return (
    <main className="plans-flow">
      <div className="plans-flow__inner">
        <Link to={STUDENT_BILLING_PATH} className="plans-flow__home-link">
          ← Back to Plans and Billing
        </Link>
        <header className="plans-flow__head">
          <p className="plans-flow__eyebrow">Plan selection</p>
          <h1>Choose your Prelude plan</h1>
          <p>Open the wallet, compare the tiers, and update your membership or purchase Essay Support.</p>
        </header>
        <PlanWalletExperience
          context="dashboard"
          user={user}
          backTo={STUDENT_BILLING_PATH}
          persistState={false}
          initialWalletOpen={initialWalletOpen}
          initialSelectedPlanId={
            selection === "essay-support" || searchParams.get("bundle") === "essay_support"
              ? "essay_support"
              : null
          }
        />
      </div>
    </main>
  );
}
