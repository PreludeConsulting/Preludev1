import { GraduationCap, HeartHandshake, Users } from "lucide-react";

const SIGNUP_ROLE_OPTIONS = [
  {
    value: "STUDENT",
    title: "Student",
    description: "Build your college roadmap and manage applications.",
    Icon: GraduationCap
  },
  {
    value: "MENTOR",
    title: "Mentor",
    description: "Support students with your college experience.",
    Icon: HeartHandshake
  },
  {
    value: "PARENT",
    title: "Parent",
    description: "Follow your student's progress and updates.",
    Icon: Users
  }
];

export default function AuthRoleSelector({ value, onChange, disabled = false, lockedRole = "", error = "" }) {
  return (
    <fieldset className="auth-role">
      <legend className="auth-role__legend">I am signing up as a</legend>
      <div className="auth-role__grid">
        {SIGNUP_ROLE_OPTIONS.map(({ value: roleValue, title, description, Icon }) => {
          const selected = value === roleValue;
          const locked = Boolean(lockedRole && lockedRole !== roleValue);
          return (
            <button
              key={roleValue}
              type="button"
              disabled={disabled || locked}
              aria-pressed={selected}
              onClick={() => onChange(roleValue)}
              className={`auth-role__option${selected ? " auth-role__option--selected" : ""}`}
            >
              <Icon className="auth-role__icon" aria-hidden="true" />
              <span className="auth-role__title">{title}</span>
              <span className="auth-role__description">{description}</span>
            </button>
          );
        })}
      </div>
      <p className={`auth-field__message${error ? " auth-field__message--error" : " auth-field__message--empty"}`} role={error ? "alert" : undefined}>
        {error || "\u00a0"}
      </p>
    </fieldset>
  );
}
