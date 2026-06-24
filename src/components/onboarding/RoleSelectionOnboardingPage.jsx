import { GraduationCap, HeartHandshake, Users } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import AppLink from "../AppLink.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { postAuthDestination, ROLE_SELECTION_PATH, userNeedsRoleSelection } from "../../lib/onboardingRoutes.js";

const ROLE_OPTIONS = [
  {
    role: "student",
    title: "Student",
    description: "Build your college roadmap, match with mentors, and manage applications.",
    Icon: GraduationCap
  },
  {
    role: "mentor",
    title: "Mentor",
    description: "Create a mentor profile, share your strengths, and support matched students.",
    Icon: HeartHandshake
  },
  {
    role: "parent",
    title: "Parent",
    description: "Follow your student's progress, calendar, and mentor updates from a parent dashboard.",
    Icon: Users
  }
];

export default function RoleSelectionOnboardingPage() {
  const navigate = useNavigate();
  const { user, ready, refreshUser } = useAuth();
  const [savingRole, setSavingRole] = useState("");
  const [error, setError] = useState("");

  if (!ready) {
    return <main className="pm-onboarding-page"><p className="text-muted-foreground">Loading...</p></main>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: ROLE_SELECTION_PATH }} />;
  }

  if (!userNeedsRoleSelection(user)) {
    return <Navigate to={postAuthDestination(user)} replace />;
  }

  async function chooseRole(role) {
    setSavingRole(role);
    setError("");
    try {
      const { saveUserRoleSelection } = await import("../../lib/supabaseAuth.js");
      const { error: saveError } = await saveUserRoleSelection(user.id, role);
      if (saveError) throw new Error(saveError);
      const nextUser = await refreshUser();
      navigate(postAuthDestination(nextUser || { ...user, role, roleSelectionComplete: true }), { replace: true });
    } catch (err) {
      setError(err.message || "Could not save your role. Please try again.");
    } finally {
      setSavingRole("");
    }
  }

  return (
    <main className="pm-onboarding-page role-onboarding">
      <div className="pm-onboarding-page__inner">
        <AppLink href="/" className="pm-onboarding-page__back">← Back to Prelude</AppLink>
        <header className="pm-onboarding-page__head">
          <p className="plan-select-page__eyebrow">First login</p>
          <h1 className="pm-onboarding-page__title">Choose your Prelude role</h1>
          <p className="pm-onboarding-page__sub">
            We use this once to send you to the right onboarding path and dashboard.
          </p>
        </header>

        {error ? <div className="plan-select-page__error" role="alert">{error}</div> : null}

        <div className="role-onboarding__grid">
          {ROLE_OPTIONS.map(({ role, title, description, Icon }) => (
            <button
              key={role}
              type="button"
              className="role-onboarding__card"
              disabled={Boolean(savingRole)}
              onClick={() => chooseRole(role)}
            >
              <span className="role-onboarding__icon" aria-hidden="true">
                <Icon className="h-6 w-6" />
              </span>
              <span className="role-onboarding__title">{title}</span>
              <span className="role-onboarding__description">{description}</span>
              <span className="role-onboarding__action">
                {savingRole === role ? "Saving..." : `Continue as ${title}`}
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
