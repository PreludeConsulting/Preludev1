import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { forwardRef, useId, useState } from "react";
import AppLink from "../AppLink.jsx";
import { useLegalModal } from "../../context/LegalModalContext.jsx";
import {
  getPasswordRequirementStatus,
  getPasswordStrength,
  passwordsMatch
} from "../../../shared/passwordValidation.js";

export function AuthBanner({ tone = "info", children, reserve = true }) {
  const hasContent = Boolean(children);
  const toneClass =
    tone === "error" ? "auth-banner--error" : tone === "success" ? "auth-banner--success" : "auth-banner--info";

  return (
    <div
      className={`auth-banner ${toneClass}${reserve ? " auth-banner--reserve" : ""}${hasContent ? " auth-banner--visible" : ""}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      {hasContent ? children : null}
    </div>
  );
}

export function AuthDivider({ children = "or" }) {
  return (
    <div className="auth-divider" role="separator">
      <span>{children}</span>
    </div>
  );
}

export const AuthField = forwardRef(function AuthField(
  {
    id,
    label,
    labelAside,
    type = "text",
    error = "",
    hint = "",
    reserveMessage = true,
    className = "",
    inputClassName = "",
    showPasswordToggle = false,
    ...props
  },
  ref
) {
  const autoId = useId();
  const fieldId = id || autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password" || showPasswordToggle;
  const inputType = isPassword && visible ? "text" : type;
  const describedBy = [error ? errorId : "", hint && !error ? hintId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`auth-field ${className}`.trim()}>
      <div className="auth-field__label-row">
        <label htmlFor={fieldId} className="auth-field__label">
          {label}
        </label>
        {labelAside ? <div className="auth-field__label-aside">{labelAside}</div> : null}
      </div>
      <div className={`auth-field__control${isPassword ? " auth-field__control--password" : ""}`}>
        <input
          {...props}
          ref={ref}
          id={fieldId}
          type={inputType}
          className={`auth-field__input ${inputClassName}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-field__toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {reserveMessage ? (
        <p
          id={errorId}
          className={`auth-field__message${error ? " auth-field__message--error" : " auth-field__message--empty"}`}
          role={error ? "alert" : undefined}
        >
          {error || "\u00a0"}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={hintId} className="auth-field__message auth-field__message--hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export const AuthPasswordField = forwardRef(function AuthPasswordField(
  { autoComplete = "current-password", type = "password", ...props },
  ref
) {
  return <AuthField {...props} ref={ref} type={type} autoComplete={autoComplete} showPasswordToggle />;
});

export function AuthSubmitButton({ children, loading = false, className = "", ...props }) {
  return (
    <button {...props} className={`auth-submit ${className}`.trim()} aria-busy={loading || undefined} disabled={props.disabled || loading}>
      {loading ? <Loader2 className="auth-submit__spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function AuthLegalAcknowledgment({ action = "signing in" }) {
  const { openLegal } = useLegalModal();

  return (
    <p className="auth-legal">
      By {action}, you agree to our{" "}
      <button
        type="button"
        className="auth-legal__link"
        onClick={(event) => {
          event.preventDefault();
          openLegal("terms");
        }}
      >
        Terms
      </button>{" "}
      and{" "}
      <button
        type="button"
        className="auth-legal__link"
        onClick={(event) => {
          event.preventDefault();
          openLegal("privacy");
        }}
      >
        Privacy Policy
      </button>
      .
    </p>
  );
}

export function AuthTermsCheckbox({ checked, onChange, disabled = false }) {
  const { openLegal } = useLegalModal();

  return (
    <label className="auth-terms">
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} required />
      <span>
        I agree to Prelude&apos;s{" "}
        <button
          type="button"
          className="auth-legal__link"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openLegal("terms");
          }}
        >
          Terms
        </button>{" "}
        and{" "}
        <button
          type="button"
          className="auth-legal__link"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openLegal("privacy");
          }}
        >
          Privacy Policy
        </button>
        .
      </span>
    </label>
  );
}

export function AuthInlineLink({ href, children, className = "" }) {
  return (
    <AppLink href={href} className={`auth-shell__text-link ${className}`.trim()}>
      {children}
    </AppLink>
  );
}

export function PasswordRequirements({ password, supabaseAuth, mode = "signup" }) {
  const hints = getPasswordRequirementStatus(password, supabaseAuth, mode);

  return (
    <ul className="auth-password-hints" aria-label="Password requirements">
      {hints.map(({ id, label, met }) => (
        <li key={id} className={met ? "auth-password-hints__item auth-password-hints__item--met" : "auth-password-hints__item"}>
          <Check size={12} aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

export function PasswordStrengthMeter({ password, supabaseAuth, mode = "signup" }) {
  const strength = getPasswordStrength(password, supabaseAuth, mode);
  const width = password ? `${Math.max(12, (strength.level / 4) * 100)}%` : "0%";

  return (
    <div className="auth-password-strength" aria-live="polite">
      <div className="auth-password-strength__track" aria-hidden="true">
        <div
          className={`auth-password-strength__bar auth-password-strength__bar--level-${strength.level}`}
          style={{ width }}
        />
      </div>
      <p className="auth-password-strength__label">
        Strength: <span>{strength.label}</span>
      </p>
    </div>
  );
}

export function PasswordMatchHint({ password, confirmPassword }) {
  if (!confirmPassword) return null;
  const matched = passwordsMatch(password, confirmPassword);

  return (
    <p
      className={`auth-password-match${matched ? " auth-password-match--ok" : " auth-password-match--error"}`}
      role={matched ? "status" : "alert"}
      aria-live="polite"
    >
      <Check size={14} aria-hidden="true" />
      <span>{matched ? "Passwords match" : "Passwords do not match"}</span>
    </p>
  );
}
