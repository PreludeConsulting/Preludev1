import { GraduationCap, HeartHandshake, Users } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { postAuthDestination, ROLE_SELECTION_PATH, userNeedsRoleSelection } from "../../lib/onboardingRoutes.js";
import OnboardingShell from "./OnboardingShell.jsx";

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
    return (
      <OnboardingShell user={user} loading title="Choose your role" subtitle="Loading your account setup…" hideContinue />
    );
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
    <OnboardingShell
      user={user}
      title="Choose your Prelude role"
      subtitle="We use this once to send you to the right onboarding path and dashboard."
      eyebrow="Account setup"
      hideContinue
      footerNote="You can update profile details later in Settings."
    >
      {error ? <div className="onboarding-flow__error" role="alert">{error}</div> : null}

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
    </OnboardingShell>
  );
}
