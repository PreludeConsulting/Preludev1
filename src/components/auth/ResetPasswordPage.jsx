import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../../lib/auth.js";
import { isSupabaseConfigured } from "../../lib/supabaseConfig.js";
import {
  maskEmail,
  passwordsMatch,
  validatePasswordForAuth
} from "../../../shared/passwordValidation.js";
import { SAME_PASSWORD_RESET_MESSAGE } from "../../../shared/passwordSameness.js";
import AuthLayout from "./AuthLayout.jsx";
import {
  AuthBanner,
  AuthInlineLink,
  AuthPasswordField,
  AuthSubmitButton,
  PasswordMatchHint,
  PasswordRequirements,
  PasswordStrengthMeter
} from "./AuthForm.jsx";
import { friendlyAuthError } from "./authErrors.js";

function focusField(ref) {
  ref.current?.focus();
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const supabaseAuth = isSupabaseConfigured();
  const params = new URLSearchParams(location.search);
  const [token] = useState(params.get("token") || "");
  const recoveryUrl = useMemo(() => ({ search: location.search, hash: location.hash }), [location.hash, location.search]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(supabaseAuth ? "checking" : token ? "ready" : "invalid");
  const [accountEmail, setAccountEmail] = useState("");
  const passwordRef = useRef(null);

  useEffect(() => {
    if (!supabaseAuth) return undefined;
    let active = true;
    let unsubscribe = () => {};

    if (recoveryUrl.search || recoveryUrl.hash) {
      window.history.replaceState({}, "", location.pathname);
    }

    import("../../lib/supabaseAuth.js").then(({ initializePasswordRecovery, onAuthStateChange }) => {
      initializePasswordRecovery(recoveryUrl.search, recoveryUrl.hash).then(({ hasRecoverySession, error: recoveryError, email }) => {
        if (!active) return;
        if (recoveryError) {
          setFormError(friendlyAuthError(recoveryError, "signin"));
          setPhase("invalid");
          return;
        }
        if (hasRecoverySession) {
          setAccountEmail(email || "");
          setPhase("ready");
          return;
        }
        setPhase("invalid");
      });

      const { data } = onAuthStateChange((event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" && session) {
          setAccountEmail(session.user?.email || "");
          setPhase("ready");
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [location.pathname, recoveryUrl.hash, recoveryUrl.search, supabaseAuth]);

  const passwordValid = !validatePasswordForAuth(password, supabaseAuth, "reset");
  const confirmValid = Boolean(confirmPassword) && passwordsMatch(password, confirmPassword);
  const canSubmit = supabaseAuth ? phase === "ready" : Boolean(token);

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    const passwordError = validatePasswordForAuth(password, supabaseAuth, "reset");
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your new password.";
    else if (!passwordsMatch(password, confirmPassword)) nextErrors.confirmPassword = "Passwords do not match.";
    setFieldErrors(nextErrors);
    if (nextErrors.password) {
      focusField(passwordRef);
      return;
    }
    if (nextErrors.confirmPassword) return;

    setFormError("");
    setLoading(true);
    try {
      if (supabaseAuth) {
        const { completePasswordReset, assertNewPasswordDiffersFromCurrent } = await import("../../lib/supabaseAuth.js");
        if (accountEmail) {
          const { error: samenessError } = await assertNewPasswordDiffersFromCurrent(accountEmail, password);
          if (samenessError) {
            setFieldErrors({ password: SAME_PASSWORD_RESET_MESSAGE });
            focusField(passwordRef);
            return;
          }
        }
        const { error: updateError } = await completePasswordReset(password, { email: accountEmail });
        if (updateError) throw new Error(updateError);
        setPhase("success");
        window.setTimeout(() => navigate("/login?reset=success", { replace: true }), 2200);
        return;
      }
      if (!token) throw new Error("This reset link is missing a token. Request a new link from the forgot password page.");
      await resetPassword(token, password);
      setPhase("success");
      window.setTimeout(() => navigate("/login?reset=success", { replace: true }), 2200);
    } catch (err) {
      setFormError(friendlyAuthError(err.message, "signin"));
    } finally {
      setLoading(false);
    }
  }

  const title =
    phase === "success"
      ? "Password updated"
      : phase === "invalid"
        ? "Reset link expired"
        : "Create a new password";

  const subtitle =
    phase === "success"
      ? "Your account is secured with your new password. Taking you to sign in…"
      : phase === "invalid"
        ? "This secure link is invalid or has expired. Request a fresh reset email to continue."
        : accountEmail
          ? `Choose a strong password for ${maskEmail(accountEmail)}. It must be different from your current password.`
          : "Choose a strong password. It must be different from your current password.";

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      headerLink={phase === "ready" ? { prefix: "Remember your password?", label: "Log in", href: "/login" } : undefined}
      panel={phase === "ready"}
    >
      {phase === "checking" ? (
        <div className="auth-inline-loading auth-reset__loading">
          <Loader2 className="auth-loading-spinner" aria-hidden="true" />
          <span>Verifying your secure reset link…</span>
        </div>
      ) : null}

      {phase === "invalid" ? (
        <div className="auth-reset__empty">
          <div className="auth-reset__icon" aria-hidden="true">
            <KeyRound size={28} />
          </div>
          <AuthBanner tone="error" reserve={Boolean(formError)}>
            {formError || "We could not verify this reset link."}
          </AuthBanner>
          <AuthSubmitButton type="button" onClick={() => navigate("/forgot-password")}>
            Request a new reset link
          </AuthSubmitButton>
          <p className="auth-reset__footnote">
            Already updated your password? <AuthInlineLink href="/login">Sign in</AuthInlineLink>
          </p>
        </div>
      ) : null}

      {phase === "success" ? (
        <div className="auth-reset__success" role="status" aria-live="polite">
          <div className="auth-reset__success-icon" aria-hidden="true">
            <CheckCircle2 size={40} />
          </div>
          <p className="auth-reset__success-copy">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>For your security, other active sessions were signed out. Use your new password to sign in.</span>
          </p>
        </div>
      ) : null}

      {phase === "ready" ? (
        <>
          <AuthBanner tone="error" reserve={Boolean(formError)}>
            {formError || null}
          </AuthBanner>
          <form className="auth-form auth-reset__form" onSubmit={onSubmit} noValidate>
            <AuthPasswordField
              ref={passwordRef}
              label="New password"
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: "" }));
              }}
              error={fieldErrors.password}
              hint="Use at least 8 characters with upper and lowercase letters and a number or special character."
              required
              minLength={supabaseAuth ? 8 : 12}
            />
            <PasswordStrengthMeter password={password} supabaseAuth={supabaseAuth} mode="reset" />
            <PasswordRequirements password={password} supabaseAuth={supabaseAuth} mode="reset" />
            <AuthPasswordField
              label="Confirm new password"
              name="confirm-new-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((current) => ({ ...current, confirmPassword: "" }));
              }}
              error={fieldErrors.confirmPassword}
              required
              minLength={supabaseAuth ? 8 : 12}
            />
            <PasswordMatchHint password={password} confirmPassword={confirmPassword} />
            <AuthSubmitButton
              disabled={loading || !canSubmit || !passwordValid || !confirmValid}
              loading={loading}
            >
              {loading ? "Updating password…" : "Update password"}
            </AuthSubmitButton>
          </form>
          <p className="auth-reset__footnote">
            Didn&apos;t request this? You can ignore the email — your password won&apos;t change until you submit this form.
          </p>
        </>
      ) : null}
    </AuthLayout>
  );
}
