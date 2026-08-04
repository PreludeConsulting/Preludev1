import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { getDashboardData, getProfile, getSessions, requestPasswordReset, revokeSession, updateProfile, verifyEmail } from "../lib/auth.js";
import { postAuthDestination, postConfirmationDestination, MATCH_ONBOARDING_PATH } from "../lib/onboardingRoutes.js";
import { signInWithGoogle } from "../lib/googleAuth.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../dashboard/components/GoogleSignInButton.jsx";
import AppLink from "./AppLink.jsx";
import TurnstileWidget from "./auth/TurnstileWidget.jsx";
import AuthLayout from "./auth/AuthLayout.jsx";
import AuthDemoSection from "./auth/AuthDemoSection.jsx";
import {
  AuthBanner,
  AuthDivider,
  AuthField,
  AuthInlineLink,
  AuthLegalAcknowledgment,
  OtpInput,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTermsCheckbox,
  PasswordRequirements
} from "./auth/AuthForm.jsx";
import { friendlyAuthError, isValidEmail } from "./auth/authErrors.js";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../../shared/passwordResetConstants.js";
import { isTurnstileRequired } from "../lib/turnstile.js";
import { readPendingJourney, savePendingJourney, clearPendingJourney, resolveJourneyDestination } from "../lib/authJourney.js";
import { sanitizeAuthRedirect } from "../lib/authRedirects.js";
import {
  clearPendingSignupVerification,
  pendingSignupResendSeconds,
  readPendingSignupVerification,
  storePendingSignupVerification
} from "../lib/signupVerificationState.js";
import { sendLoginVerificationCode, verifyLoginCode } from "../lib/loginVerification.js";
import { maskEmail } from "../../shared/passwordValidation.js";
export { default as ResetPasswordPage } from "./auth/ResetPasswordPage.jsx";

const RESEND_COOLDOWN_SECONDS = 30;

function validateSignupPassword(password, supabaseAuth) {
  if (supabaseAuth) {
    if (password.length < 6) return "Password must be at least 6 characters.";
    return "";
  }
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain a symbol.";
  return "";
}

export function friendlyVerificationError(error) {
  const code = error?.payload?.error || "";
  if (code === "cooldown") return error.message || "Please wait before requesting another code.";
  if (code === "rate_limited") return "Too many attempts. Please wait a moment and try again.";
  if (code === "email_delivery_failed") return "Prelude could not send the verification email. Please try again or contact support.";
  if (code === "login_verification_storage_missing") return error.message || "Prelude login verification storage is not configured yet. Ask an admin to run the Supabase login verification migration.";
  if (code === "html_response") {
    return "We couldn’t verify your email right now. Please try again.";
  }
  if (code === "expired_code" || code === "used_code" || code === "incorrect_code") {
    return "That code is invalid or has expired. Request a new code and use the newest email.";
  }
  if (code === "missing_challenge") return "This verification request is no longer active. Request a new code.";
  if (code === "locked_challenge") return "Too many incorrect attempts. Request a new code.";
  if (code === "invalid_code" || code === "validation_error") return "Enter the complete six-digit code.";
  if (code === "email_unconfirmed") return "Confirm your email address before completing login verification.";
  if (code === "missing_email") {
    return "We could not determine which email is being verified. Please restart sign-in.";
  }
  if (error?.status === 401) return "Your secure session expired. Sign in again to continue.";
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return "We couldn’t verify your email right now. Please try again.";
  }
  if (code === "server_error" || Number(error?.status) >= 500) {
    return "We couldn’t verify your email right now. Please try again.";
  }
  if (import.meta.env.DEV && error?.message) {
    console.error("[prelude-auth] login_verification_unmapped_error", {
      errorName: error?.name || null,
      errorCode: code || null,
      status: error?.status || null,
      message: error.message
    });
  }
  return "We couldn’t verify your email right now. Please try again.";
}

export function isEmailUnconfirmedError(message = "") {
  return /confirm your email|email not confirmed|email_unconfirmed|email_unconfirmed/i.test(String(message || ""));
}

export function shouldRouteToSignupVerification(error, authenticatedUser = null) {
  const authoritativeUser = authenticatedUser || error?.authenticatedUser;
  return !authoritativeUser?.emailVerified && isEmailUnconfirmedError(error?.message);
}

function focusField(ref) {
  ref.current?.focus();
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInAsDemo, user, ready } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState(() =>
    new URLSearchParams(location.search).get("reset") === "success"
      ? "Your password has been updated. Log in with your new password."
      : ""
  );
  const [authAction, setAuthAction] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const destination = sanitizeAuthRedirect(location.state?.from || new URLSearchParams(location.search).get("next") || "");
  const loading = Boolean(authAction);
  const googleLoading = authAction === "google";
  const emailLoading = authAction === "email";

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = window.setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      const pending = readPendingJourney();
      navigate(pending ? resolveJourneyDestination(pending, user) : postAuthDestination(user), { replace: true });
      clearPendingJourney();
    }
  }, [ready, user, navigate]);

  function validateForm() {
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setFieldErrors(nextErrors);
    if (nextErrors.email) focusField(emailRef);
    else if (nextErrors.password) focusField(passwordRef);
    return Object.keys(nextErrors).length === 0;
  }

  async function onGoogle() {
    setFormError("");
    setFieldErrors({});
    setAuthAction("google");
    let redirecting = false;
    try {
      const { url, error: oauthError, message: oauthMessage } = await signInWithGoogle({ next: destination });
      if (oauthError) {
        setFormError(friendlyAuthError(oauthError, "signin"));
        return;
      }
      if (url) {
        redirecting = true;
        window.location.assign(url);
        return;
      }
      setFormError(friendlyAuthError(oauthMessage || "Google sign-in did not return a redirect URL.", "signin"));
    } catch (err) {
      console.error("Unexpected Google OAuth failure:", err);
      setFormError(friendlyAuthError(err?.message, "signin"));
    } finally {
      if (!redirecting) setAuthAction("");
    }
  }

  async function loginWithCredentials(loginEmail, loginPassword) {
    if (!validateForm()) return;
    setAuthAction("email");
    setFormError("");
    setMessage("");
    let authenticatedUser = null;
    try {
      const nextUser = await signIn(loginEmail, loginPassword, { captchaToken });
      authenticatedUser = nextUser;
      if (nextUser?.requiresLoginVerification) {
        const challenge = nextUser.challengeId ? `&challenge=${encodeURIComponent(nextUser.challengeId)}` : "";
        navigate(`/verify-login?next=${encodeURIComponent(destination || "/dashboard")}${challenge}`, { replace: true });
        return;
      }
      const requestedDestination = resolveJourneyDestination(readPendingJourney() || { next: destination }, nextUser);
      navigate(postConfirmationDestination(nextUser, requestedDestination), { replace: true });
      clearPendingJourney();
    } catch (err) {
      if (shouldRouteToSignupVerification(err, authenticatedUser)) {
        const targetEmail = loginEmail.trim();
        storePendingSignupVerification(targetEmail, { cooldownSeconds: 0 });
        navigate("/verify-email", { replace: true });
        return;
      }
      setFormError(friendlyAuthError(err.message, "signin"));
      setCaptchaToken("");
      turnstileRef.current?.reset();
    } finally {
      setAuthAction("");
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    await loginWithCredentials(email, password);
  }

  async function resendConfirmationEmail() {
    const targetEmail = confirmationEmail || email.trim();
    if (!targetEmail) {
      setFormError("Enter your email, then request a new confirmation email.");
      return;
    }
    setResending(true);
    setFormError("");
    try {
      const { resendSignupConfirmation } = await import("../lib/supabaseAuth.js");
      await resendSignupConfirmation(targetEmail);
      setMessage(`A new confirmation email was sent to ${maskEmail(targetEmail)}.`);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(friendlyAuthError(err.message, "signin"));
    } finally {
      setResending(false);
    }
  }

  async function continueAsDemo(accountKey) {
    setAuthAction(`demo-${accountKey}`);
    setFormError("");
    try {
      const nextUser = await signInAsDemo(accountKey);
      const nextPath =
        destination && destination !== "/dashboard"
          ? destination
          : postAuthDestination(nextUser);
      navigate(nextPath, { replace: true });
    } catch (err) {
      setFormError(friendlyAuthError(err.message, "signin"));
    } finally {
      setAuthAction("");
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue to your Prelude dashboard."
      headerLink={{ prefix: "Don't have an account?", label: "Sign up", href: "/register" }}
      footer={<AuthLegalAcknowledgment action="signing in" />}
    >
      <GoogleSignInButton label="Log in with Google" onClick={onGoogle} disabled={loading} loading={googleLoading} />
      <AuthDivider />
      {(formError || message) ? (
        <AuthBanner tone={formError ? "error" : "success"}>
          {formError || message}
        </AuthBanner>
      ) : null}
      {confirmationEmail ? (
        <div className="auth-inline-actions">
          {supabaseAuth ? (
            <button type="button" disabled={resending || resendCooldown > 0} onClick={resendConfirmationEmail}>
              {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
            </button>
          ) : null}
          <AuthInlineLink href="/register">Create a different account</AuthInlineLink>
        </div>
      ) : null}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <AuthField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: "" }));
          }}
          error={fieldErrors.email}
          required
        />
        <AuthPasswordField
          ref={passwordRef}
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: "" }));
          }}
          error={fieldErrors.password}
          labelAside={<AuthInlineLink href="/forgot-password">Forgot password?</AuthInlineLink>}
          required
        />
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <AuthSubmitButton disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)} loading={emailLoading}>
          {emailLoading ? "Logging in…" : "Log in"}
        </AuthSubmitButton>
      </form>
      <AuthDemoSection loading={loading} activeAction={authAction} onDemo={continueAsDemo} />
    </AuthLayout>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const parentInviteToken = searchParams.get("parentInvite") || "";
  const invitedAsParent = Boolean(parentInviteToken);
  const prefilledEmail = searchParams.get("email")?.trim() || "";
  const { signUp } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const destination = sanitizeAuthRedirect(location.state?.from || searchParams.get("next") || "");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: prefilledEmail,
    password: "",
    termsAccepted: false,
    parentInviteToken
  });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [authAction, setAuthAction] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const loading = Boolean(authAction);
  const googleLoading = authAction === "google";
  const signupLoading = authAction === "signup";

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const id = window.setInterval(() => setResendCountdown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCountdown]);

  useEffect(() => {
    const mentorId = searchParams.get("mentor");
    const serviceId = searchParams.get("service");
    const planId = searchParams.get("plan");
    const journeyNext = destination || MATCH_ONBOARDING_PATH;
    savePendingJourney({ next: journeyNext, mentorId, serviceId, planId, onboardingStep: "match" });
  }, [destination, searchParams]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
    if (fieldErrors[key]) setFieldErrors((current) => ({ ...current, [key]: "" }));
  };

  function validateForm() {
    const nextErrors = {};
    if (!form.firstName.trim()) nextErrors.firstName = "Enter your first name.";
    if (!form.lastName.trim()) nextErrors.lastName = "Enter your last name.";
    if (!form.email.trim()) nextErrors.email = "Enter your email address.";
    else if (!isValidEmail(form.email)) nextErrors.email = "Enter a valid email address.";
    const passwordError = validateSignupPassword(form.password, supabaseAuth);
    if (passwordError) nextErrors.password = passwordError;
    if (!form.termsAccepted) nextErrors.terms = "Accept the Terms and Privacy Policy to continue.";
    setFieldErrors(nextErrors);
    if (nextErrors.firstName) focusField(firstNameRef);
    else if (nextErrors.lastName) focusField(lastNameRef);
    else if (nextErrors.email) focusField(emailRef);
    else if (nextErrors.password) focusField(passwordRef);
    return Object.keys(nextErrors).length === 0;
  }

  async function onGoogle() {
    setFormError("");
    setMessage("");
    setFieldErrors({});
    setAuthAction("google");
    let redirecting = false;
    try {
      const { url, error: oauthError, message: oauthMessage } = await signInWithGoogle({ next: destination });
      if (oauthError) {
        setFormError(friendlyAuthError(oauthError, "signup"));
        return;
      }
      if (url) {
        redirecting = true;
        window.location.assign(url);
        return;
      }
      setMessage(oauthMessage || "Google sign-up will be available once OAuth is configured.");
    } catch (err) {
      console.error("Unexpected Google OAuth failure:", err);
      setFormError(friendlyAuthError(err?.message, "signup"));
    } finally {
      if (!redirecting) setAuthAction("");
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;
    setAuthAction("signup");
    setFormError("");
    setMessage("");
    try {
      const result = await signUp({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        termsAccepted: form.termsAccepted,
        captchaToken,
        ...(invitedAsParent
          ? { role: "PARENT", parentInviteToken: parentInviteToken || form.parentInviteToken }
          : {})
      });

      if (result?.needsEmailConfirmation || result?.verificationEmailSent) {
        if (supabaseAuth) {
          storePendingSignupVerification(form.email.trim());
          navigate("/verify-email", { replace: true });
          return;
        }
        setConfirmationEmail(form.email.trim());
        if (result?.verificationEmailError) {
          setFormError(result.verificationEmailError);
          setMessage("Your account was created, but Prelude could not send the verification email automatically. Use resend to try again.");
        } else {
          setMessage(
            `We sent a confirmation email to ${maskEmail(form.email.trim())}. Verify your address before logging in.`
          );
        }
        return;
      }
      if (result?.id) {
        if (result?.requiresLoginVerification) {
          const challenge = result.challengeId ? `&challenge=${encodeURIComponent(result.challengeId)}` : "";
          const verificationDestination = resolveJourneyDestination(
            readPendingJourney() || { next: destination || MATCH_ONBOARDING_PATH },
            result
          );
          const verifyQuery = `/verify-login?next=${encodeURIComponent(verificationDestination || MATCH_ONBOARDING_PATH)}${challenge}`;
          navigate(verifyQuery, {
            replace: true,
            state: result?.loginVerificationError
              ? { loginVerificationError: result.loginVerificationError }
              : undefined
          });
          return;
        }
        const requestedDestination = resolveJourneyDestination(
          readPendingJourney() || { next: destination || MATCH_ONBOARDING_PATH },
          result
        );
        navigate(postConfirmationDestination(result, requestedDestination), { replace: true });
        clearPendingJourney();
        return;
      }
      setMessage(result?.message || "Account created.");
    } catch (err) {
      console.error("[prelude-auth] signup_failed", err?.message || err, err);
      const duplicate = /already exists|already registered|try logging in/i.test(err.message || "");
      if (supabaseAuth && duplicate) {
        storePendingSignupVerification(form.email);
        navigate("/verify-email", { replace: true });
      } else {
        setFormError(friendlyAuthError(err.message, "signup"));
      }
      setCaptchaToken("");
      turnstileRef.current?.reset();
    } finally {
      setAuthAction("");
    }
  }

  async function resendConfirmationEmail() {
    const targetEmail = confirmationEmail || form.email.trim();
    if (!targetEmail) {
      setFormError("Enter the email you used to sign up, then request a new confirmation email.");
      return;
    }
    setResending(true);
    setFormError("");
    try {
      const { resendSignupConfirmation } = await import("../lib/supabaseAuth.js");
      await resendSignupConfirmation(targetEmail);
      setMessage(`A new confirmation email was sent to ${maskEmail(targetEmail)}.`);
      setResendCountdown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setFormError(friendlyAuthError(err.message, "signup"));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title={invitedAsParent ? "Create your parent account" : "Create your account"}
      subtitle={
        invitedAsParent
          ? "You've been invited to follow your student's college journey on Prelude."
          : "Create your account, verify your email, and begin your Prelude experience."
      }
      headerLink={{ prefix: "Already have an account?", label: "Log in", href: "/login" }}
    >
      {!invitedAsParent ? (
        <>
          <GoogleSignInButton label="Sign up with Google" onClick={onGoogle} disabled={loading} loading={googleLoading} />
          <AuthDivider />
        </>
      ) : null}
      {(formError || message) ? (
        <AuthBanner tone={formError ? "error" : "success"}>
          {formError || message}
        </AuthBanner>
      ) : null}
      {message ? (
        <div className="auth-inline-actions">
          {supabaseAuth ? (
            <button type="button" disabled={resending || resendCountdown > 0} onClick={resendConfirmationEmail}>
              {resending ? "Sending…" : resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend confirmation email"}
            </button>
          ) : null}
          <AuthInlineLink href="/login">Go to login</AuthInlineLink>
        </div>
      ) : null}
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-form__row">
          <AuthField
            ref={firstNameRef}
            label="First name"
            name="given-name"
            autoComplete="given-name"
            value={form.firstName}
            onChange={update("firstName")}
            error={fieldErrors.firstName}
            required
          />
          <AuthField
            ref={lastNameRef}
            label="Last name"
            name="family-name"
            autoComplete="family-name"
            value={form.lastName}
            onChange={update("lastName")}
            error={fieldErrors.lastName}
            required
          />
        </div>
        <AuthField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={update("email")}
          error={fieldErrors.email}
          required
        />
        <AuthPasswordField
          ref={passwordRef}
          label="Password"
          name="new-password"
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
          error={fieldErrors.password}
          required
          minLength={supabaseAuth ? 6 : 12}
        />
        <PasswordRequirements password={form.password} supabaseAuth={supabaseAuth} />
        {invitedAsParent ? (
          <AuthBanner tone="info" reserve>
            You&apos;ll continue as a parent account for this invitation.
          </AuthBanner>
        ) : null}
        <AuthTermsCheckbox checked={form.termsAccepted} onChange={update("termsAccepted")} disabled={loading} />
        {fieldErrors.terms ? (
          <p className="auth-field__message auth-field__message--error" role="alert">
            {fieldErrors.terms}
          </p>
        ) : (
          <p className="auth-field__message auth-field__message--empty" aria-hidden="true">
            {"\u00a0"}
          </p>
        )}
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <AuthSubmitButton
          disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)}
          loading={signupLoading}
        >
          {signupLoading ? "Creating account…" : "Create account"}
        </AuthSubmitButton>
      </form>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const supabaseAuth = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const emailRef = useRef(null);

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    else if (!isValidEmail(email)) nextErrors.email = "Enter a valid email address.";
    setFieldErrors(nextErrors);
    if (nextErrors.email) {
      focusField(emailRef);
      return;
    }
    setLoading(true);
    setFormError("");
    setMessage("");
    try {
      if (supabaseAuth) {
        const { resetPassword: supabaseReset } = await import("../lib/supabaseAuth.js");
        const { error: resetError } = await supabaseReset(email.trim(), captchaToken);
        if (resetError) throw new Error(resetError);
        setMessage(PASSWORD_RESET_GENERIC_MESSAGE);
        return;
      }
      const result = await requestPasswordReset(email);
      setMessage(result.message);
    } catch (err) {
      setFormError(friendlyAuthError(err.message, "signin"));
      setCaptchaToken("");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send a secure reset link if an account exists."
      headerLink={{ prefix: "Remember your password?", label: "Log in", href: "/login" }}
    >
      <AuthBanner tone="success" reserve={Boolean(message)}>
        {message || null}
      </AuthBanner>
      <AuthBanner tone="error" reserve={Boolean(formError)}>
        {formError || null}
      </AuthBanner>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <AuthField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (fieldErrors.email) setFieldErrors({});
          }}
          error={fieldErrors.email}
          required
        />
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <AuthSubmitButton disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)} loading={loading}>
          {loading ? "Sending link…" : "Send reset link"}
        </AuthSubmitButton>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const verificationUrl = useMemo(() => ({ search: window.location.search, hash: window.location.hash }), []);
  const verificationToken = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const pendingVerification = useMemo(() => readPendingSignupVerification(), []);
  const [email, setEmail] = useState(pendingVerification?.email || "");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [state, setState] = useState({ checking: true, processing: false, message: "", error: "", alreadyVerified: false });
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => pendingSignupResendSeconds(pendingVerification));
  const code = digits.join("");

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const id = window.setInterval(() => {
      setResendCooldown(pendingSignupResendSeconds(readPendingSignupVerification()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (!supabaseAuth) {
      if (!verificationToken) {
        setState({
          checking: false,
          processing: false,
          message: "",
          error: "This verification link is missing a token. Request a new link from your account settings or sign up again.",
          alreadyVerified: false
        });
        return undefined;
      }

      let cancelled = false;
      verifyEmail(verificationToken)
        .then(async (result) => {
          if (cancelled) return;
          await refreshUser();
          setState({
            checking: false,
            processing: false,
            message: result.message || "Email verified.",
            error: "",
            alreadyVerified: Boolean(result.alreadyVerified)
          });
        })
        .catch((err) => {
          if (!cancelled) setState({ checking: false, processing: false, message: "", error: friendlyAuthError(err.message, "signup"), alreadyVerified: false });
        });

      return () => {
        cancelled = true;
      };
    }

    const hasCompatibilityCallback = /(?:code|token_hash|access_token|refresh_token|error)=/.test(
      `${verificationUrl.search}&${verificationUrl.hash}`
    );

    // Manual OTP entry only — do not call Supabase on mount unless a link callback is present.
    // Auto-running verification without params previously raced with OTP entry and confused errors.
    if (!hasCompatibilityCallback) {
      setState({ checking: false, processing: false, message: "", error: "", alreadyVerified: false });
      return undefined;
    }

    let cancelled = false;
    import("../lib/supabaseAuth.js")
      .then(({ completeEmailVerification }) => completeEmailVerification(verificationUrl.search, verificationUrl.hash))
      .then(async ({ user: nextUser, error, alreadyVerified }) => {
        if (cancelled) return;
        if (error) {
          setState({
            checking: false,
            processing: false,
            message: "",
            error: friendlyAuthError(error, "signup"),
            alreadyVerified: false
          });
          return;
        }
        const refreshedUser = await refreshUser();
        if (cancelled) return;
        const resolvedUser = refreshedUser || nextUser;
        clearPendingSignupVerification();
        const pending = readPendingJourney() || { next: MATCH_ONBOARDING_PATH };
        navigate(resolveJourneyDestination(pending, resolvedUser), { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setState({ checking: false, processing: false, message: "", error: friendlyAuthError(err.message, "signup"), alreadyVerified: false });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshUser, supabaseAuth, verificationToken, verificationUrl.hash, verificationUrl.search, navigate]);

  async function submitVerification(event) {
    event.preventDefault();
    if (state.processing || resending || !/^\d{6}$/.test(code)) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setState((current) => ({
        ...current,
        error: "We could not determine which email is being verified. Please restart sign-in."
      }));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setState((current) => ({ ...current, error: "Enter the email address used to create your account." }));
      return;
    }
    storePendingSignupVerification(normalizedEmail, { cooldownSeconds: resendCooldown });
    setState((current) => ({ ...current, processing: true, error: "", message: "" }));
    try {
      const { verifySignupOtp } = await import("../lib/supabaseAuth.js");
      const { user: verifiedUser, error } = await verifySignupOtp(normalizedEmail, code);
      if (error) {
        setState((current) => ({ ...current, processing: false, error }));
        return;
      }
      const refreshedUser = (await refreshUser()) || verifiedUser;
      clearPendingSignupVerification();
      const pending = readPendingJourney() || { next: MATCH_ONBOARDING_PATH };
      navigate(resolveJourneyDestination(pending, refreshedUser), { replace: true });
    } catch (error) {
      setState((current) => ({ ...current, processing: false, error: friendlyAuthError(error.message, "signup") }));
    }
  }

  async function resendConfirmation() {
    if (resending || state.processing || resendCooldown > 0) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setState((current) => ({
        ...current,
        error: "We could not determine which email is being verified. Please restart sign-in."
      }));
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setState((current) => ({ ...current, error: "Enter the email address used to create your account." }));
      return;
    }
    setResending(true);
    try {
      const { resendSignupConfirmation } = await import("../lib/supabaseAuth.js");
      await resendSignupConfirmation(normalizedEmail);
      storePendingSignupVerification(normalizedEmail);
      setDigits(["", "", "", "", "", ""]);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setState({
        checking: false,
        processing: false,
        message: "A new six-digit code was sent. Use the newest email — older codes no longer work.",
        error: "",
        alreadyVerified: false
      });
    } catch (error) {
      setState((current) => ({ ...current, error: friendlyAuthError(error.message, "signup"), message: "" }));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={email ? `Enter the six-digit code sent to ${maskEmail(email)}.` : "Enter the email used to sign up and its six-digit verification code."}
      headerLink={{ prefix: "Need help?", label: "Log in", href: "/login" }}
    >
      {state.checking ? (
        <div className="auth-inline-loading">
          <Loader2 className="auth-loading-spinner" aria-hidden="true" />
          <span>Checking your verification status…</span>
        </div>
      ) : null}
      <AuthBanner tone="error" reserve={Boolean(state.error)}>
        {state.error || null}
      </AuthBanner>
      {!state.checking && supabaseAuth ? (
        <form className="auth-form auth-verify-form" onSubmit={submitVerification} noValidate>
          <AuthField
            label="Email"
            type="email"
            name="verification-email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (state.error) setState((current) => ({ ...current, error: "" }));
            }}
            disabled={state.processing || resending}
            required
          />
          <OtpInput
            value={digits}
            onChange={(nextDigits) => {
              setDigits(nextDigits);
              if (state.error) setState((current) => ({ ...current, error: "" }));
            }}
            disabled={state.processing || resending}
            error={state.error}
            label="Six-digit signup verification code"
          />
          <AuthSubmitButton disabled={state.processing || resending || code.length !== 6} loading={state.processing}>
            {state.processing ? "Verifying email…" : "Verify email"}
          </AuthSubmitButton>
        </form>
      ) : null}
      {!state.checking && supabaseAuth ? (
        <div className="auth-resend" aria-live="polite">
          <p>{state.error ? "" : state.message || "The code expires according to your Supabase email OTP settings."}</p>
          <div className="auth-resend__actions">
            <button type="button" disabled={state.processing || resending || resendCooldown > 0} onClick={resendConfirmation}>
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resending ? "Sending…" : "Resend code"}
            </button>
            <AppLink to="/register">Use a different email</AppLink>
          </div>
        </div>
      ) : null}
    </AuthLayout>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser, refreshLoginVerification } = useAuth();
  const processed = useRef(false);
  const callbackPromise = useRef(null);
  const callbackUrl = useMemo(() => ({ search: window.location.search, hash: window.location.hash }), []);
  const [state, setState] = useState({ loading: true, error: "", message: "Finishing Google sign-in…" });
  const nextPath = sanitizeAuthRedirect(searchParams.get("next") || "", "/dashboard");

  useEffect(() => {
    let active = true;

    if (callbackUrl.search || callbackUrl.hash) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (!processed.current) {
      processed.current = true;
      callbackPromise.current = import("../lib/supabaseAuth.js").then(({ completeAuthCallback }) =>
        completeAuthCallback(callbackUrl.search, callbackUrl.hash)
      );
    }

    callbackPromise.current
      .then(async ({ user: nextUser, error }) => {
        if (!active) return;
        if (error) {
          setState({ loading: false, error: friendlyAuthError(error, "signin"), message: "" });
          return;
        }
        const refreshed = await refreshUser();
        if (!active) return;
        const resolvedUser = refreshed || nextUser;
        // Google already proved identity with the OAuth provider. Do not send
        // confirmed users through a second email OTP on the callback path.
        if (resolvedUser?.emailVerified) {
          await refreshLoginVerification({ forceVerified: true, silent: true });
        }
        if (!active) return;
        if (!resolvedUser?.emailVerified) {
          navigate("/verify-email", { replace: true });
          return;
        }
        const requestedDestination = nextPath === "/dashboard" ? "" : nextPath;
        const destination = postConfirmationDestination(resolvedUser, requestedDestination);
        setState({ loading: false, error: "", message: "Signed in. Opening Prelude…" });
        navigate(destination, { replace: true });
        clearPendingJourney();
      })
      .catch((err) => {
        if (active) {
          setState({ loading: false, error: friendlyAuthError(err.message, "signin"), message: "" });
        }
      });
    return () => {
      active = false;
    };
  }, [callbackUrl.hash, callbackUrl.search, navigate, nextPath, refreshLoginVerification, refreshUser]);

  return (
    <AuthLayout title="Finishing Google sign-in" subtitle="Prelude is restoring your session securely." headerLink={{ prefix: "Having trouble?", label: "Log in", href: "/login" }}>
      {state.loading ? (
        <div className="auth-inline-loading">
          <Loader2 className="auth-loading-spinner" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}
      <AuthBanner tone="success" reserve={Boolean(state.message && !state.loading)}>
        {state.message && !state.loading ? state.message : null}
      </AuthBanner>
      <AuthBanner tone="error" reserve={Boolean(state.error)}>
        {state.error || null}
      </AuthBanner>
    </AuthLayout>
  );
}

export function VerifyLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, ready, signOut, refreshLoginVerification, refreshUser } = useAuth();
  const autoSendRef = useRef(false);
  const verificationInFlightRef = useRef(false);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [challengeId, setChallengeId] = useState(searchParams.get("challenge") || "");
  const [trustDevice, setTrustDevice] = useState(true);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [status, setStatus] = useState("waiting");
  const [message, setMessage] = useState("We sent a six-digit code to your email.");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");
  const nextPath = sanitizeAuthRedirect(searchParams.get("next") || "", "/dashboard");
  const code = digits.join("");
  const loading = status === "sending" || status === "verifying" || status === "success";
  const maskedEmail = maskEmail(user?.email || "");

  function focusFirstOtpInput() {
    window.requestAnimationFrame(() => {
      const field = document.querySelector(".auth-otp__input");
      if (field?.isConnected && !field.disabled) {
        field.focus();
        field.select();
      }
    });
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate("/login", { replace: true, state: { from: nextPath } });
  }, [navigate, nextPath, ready, user]);

  useEffect(() => {
    if (!ready || !user?.id || challengeId || autoSendRef.current) return;
    autoSendRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const existing = await refreshLoginVerification({ silent: true });
        if (cancelled) return;
        if (existing?.verified) {
          await refreshLoginVerification({ forceVerified: true, silent: true });
          const destination = resolveJourneyDestination(
            readPendingJourney() || { next: nextPath === "/dashboard" ? "" : nextPath },
            user
          );
          navigate(postConfirmationDestination(user, destination), { replace: true });
          clearPendingJourney();
          return;
        }
      } catch {
        /* continue to send a code */
      }

      const storageKey = `prelude-login-code-autosent:${user.id}:${nextPath}`;
      const alreadyRequested = (() => {
        try {
          return sessionStorage.getItem(storageKey) === "1";
        } catch {
          return false;
        }
      })();
      if (alreadyRequested) {
        setStatus("waiting");
        return;
      }

      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        /* ignore */
      }

      setStatus("sending");
      setMessage("Sending a verification code to your email…");
      setError("");

      try {
        const result = await sendLoginVerificationCode();
        if (cancelled) return;
        setChallengeId(result.challengeId || "");
        setCooldown(Number(result.retryAfter || RESEND_COOLDOWN_SECONDS));
        setMessage(result.emailSent ? "Verification code sent. Check your email." : "Prelude could not confirm email delivery. Please use resend.");
        setStatus("waiting");
        focusFirstOtpInput();
      } catch (err) {
        if (cancelled) return;
        if (err?.payload?.error === "cooldown") {
          setCooldown(Number(err.payload.retryAfter || RESEND_COOLDOWN_SECONDS));
          setMessage("A verification code was just sent. Check your email or wait a moment to resend.");
          setStatus("waiting");
          return;
        }
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* ignore */
        }
        setStatus("delivery_failed");
        setError(friendlyVerificationError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [challengeId, navigate, nextPath, ready, refreshLoginVerification, user, user?.id]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    focusFirstOtpInput();
  }, []);

  useEffect(() => {
    if (code.length !== 6 || loading || submittedCode === code) return;
    const id = window.setTimeout(() => {
      document.getElementById("verify-login-form")?.requestSubmit();
    }, 180);
    return () => window.clearTimeout(id);
  }, [code, loading, submittedCode]);

  async function onResend() {
    if (loading || cooldown > 0 || verificationInFlightRef.current) return;
    setStatus("sending");
    setError("");
    try {
      const result = await sendLoginVerificationCode();
      setChallengeId(result.challengeId || "");
      setDigits(["", "", "", "", "", ""]);
      setSubmittedCode("");
      setCooldown(Number(result.retryAfter || RESEND_COOLDOWN_SECONDS));
      setMessage(
        result.emailSent
          ? "A new verification code was sent. Use the newest email — older codes no longer work."
          : "Prelude could not confirm email delivery. Please try again."
      );
      setStatus("waiting");
      focusFirstOtpInput();
    } catch (err) {
      setStatus("delivery_failed");
      setError(friendlyVerificationError(err));
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || loading || verificationInFlightRef.current) return;
    if (!user?.email) {
      setError("We could not determine which email is being verified. Please restart sign-in.");
      return;
    }
    verificationInFlightRef.current = true;
    setStatus("verifying");
    setError("");
    setSubmittedCode(code);
    try {
      const result = await verifyLoginCode({ challengeId, code, trustDevice });
      if (!result?.verified) {
        throw Object.assign(new Error("Login verification could not be confirmed."), {
          payload: { error: "server_error" }
        });
      }

      // Cookie propagation can lag one request behind Set-Cookie. Refresh the
      // user profile first, then force-mark login verified from the successful
      // verify response so a lagging cookie check cannot bounce the user back.
      const refreshed = await refreshUser().catch(() => user);
      await refreshLoginVerification({ forceVerified: true, silent: true });
      setStatus("success");
      setMessage("Verification successful. Opening Prelude…");
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const resolved = refreshed || user;
      const pendingDestination = resolveJourneyDestination(
        readPendingJourney() || { next: nextPath === "/dashboard" ? "" : nextPath },
        resolved
      );
      navigate(postConfirmationDestination(resolved, pendingDestination), { replace: true });
      clearPendingJourney();
    } catch (err) {
      if (import.meta.env.DEV) console.error("Login verification failed", err);
      const errorCode = err?.payload?.error;
      setStatus(errorCode === "expired_code" ? "expired" : errorCode === "locked_challenge" ? "locked" : errorCode === "incorrect_code" ? "incorrect" : "waiting");
      setError(friendlyVerificationError(err));
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      focusFirstOtpInput();
    } finally {
      verificationInFlightRef.current = false;
    }
  }

  return (
    <AuthLayout
      title={status === "success" ? "Email verified" : "Check your email"}
      subtitle={
        maskedEmail
          ? `We sent a 6-digit code to ${maskedEmail}.`
          : "We sent a 6-digit code to your confirmed email."
      }
      headerLink={{ prefix: "Not your account?", label: "Use a different email", href: "/login" }}
    >
      {user?.email ? <span className="sr-only">Full destination email: {user.email}</span> : null}
      {status === "success" ? (
        <div className="auth-success-state" role="status" aria-live="polite">
          <span className="auth-success-state__icon" aria-hidden="true">
            <CheckCircle2 size={28} />
          </span>
          <p>Opening Prelude…</p>
        </div>
      ) : null}

      {status !== "success" ? (
        <form id="verify-login-form" className={`auth-form auth-verify-form${shake ? " auth-verify-form--shake" : ""}`} onSubmit={onSubmit} noValidate>
          <OtpInput
            value={digits}
            onChange={(nextDigits) => {
              setDigits(nextDigits);
              if (error) setError("");
            }}
            disabled={loading}
            error={error}
            label="Six-digit email verification code"
          />

          <AuthSubmitButton disabled={loading || code.length !== 6} loading={status === "verifying"}>
            {status === "verifying" ? "Verifying email…" : "Verify email"}
          </AuthSubmitButton>

          <label className="auth-trust-device">
            <input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} />
            <span>
              <strong>Trust this device for 30 days</strong>
              <small>Use this only on a private browser.</small>
            </span>
          </label>
        </form>
      ) : null}

      <div className="auth-resend" aria-live="polite">
        <p>{error ? "" : message}</p>
        <div className="auth-resend__actions">
          <button type="button" disabled={loading || cooldown > 0} onClick={onResend}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : status === "sending" ? "Sending…" : "Resend code"}
          </button>
          <button type="button" onClick={signOut}>Use a different email</button>
        </div>
      </div>
    </AuthLayout>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ready && !user) navigate("/login", { replace: true });
    if (ready && user) getDashboardData().then(setData).catch((err) => setError(err.message));
  }, [ready, user, navigate]);
  const cards = useMemo(() => {
    if (!data) return [];
    if (data.role === "STUDENT") return ["Profile", "College applications", "Essays", "Mentorship sessions", "Messages", "Notifications", "Progress tracking"];
    if (data.role === "MENTOR") return ["Assigned students", "Session notes", "Student progress"];
    if (data.role === "COUNSELOR") return ["Student roster", "Analytics", "Organization progress"];
    return ["Platform metrics", "User management", "Reports", "Security events"];
  }, [data]);
  return (
    <AuthLayout title="Dashboard" subtitle={user ? `Signed in as ${user.name} (${user.role})` : "Loading…"} panel>
      <AuthBanner tone="error" reserve={Boolean(error)}>{error || null}</AuthBanner>
      {!data ? <p>Loading dashboard…</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <div key={card} className="rounded-2xl border border-border bg-background/70 p-5">
              <h2 className="font-semibold">{card}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Visible only after server-side RBAC and ownership checks.</p>
            </div>
          ))}
        </div>
      )}
    </AuthLayout>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    getProfile().then(setProfile).catch((err) => setError(err.message));
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    const result = await updateProfile({ firstName: profile.user.firstName, lastName: profile.user.lastName });
    setProfile((current) => ({ ...current, user: result.user }));
    setMessage("Profile updated.");
  }
  return (
    <AuthLayout title="Profile" panel>
      <AuthBanner tone="error" reserve={Boolean(error)}>{error || null}</AuthBanner>
      <AuthBanner tone="success" reserve={Boolean(message)}>{message || null}</AuthBanner>
      {profile ? (
        <form className="auth-form" onSubmit={onSubmit}>
          <AuthField label="First name" value={profile.user.firstName} onChange={(e) => setProfile((p) => ({ ...p, user: { ...p.user, firstName: e.target.value } }))} />
          <AuthField label="Last name" value={profile.user.lastName} onChange={(e) => setProfile((p) => ({ ...p, user: { ...p.user, lastName: e.target.value } }))} />
          <AuthSubmitButton>Save profile</AuthSubmitButton>
        </form>
      ) : (
        <p>Loading profile…</p>
      )}
    </AuthLayout>
  );
}

export function SettingsPage() {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const load = () => getSessions().then((result) => setSessions(result.sessions)).catch((err) => setError(err.message));
  useEffect(load, []);
  async function revoke(id) {
    await revokeSession(id);
    load();
  }
  return (
    <AuthLayout title="Settings" subtitle="Manage active devices and revoke sessions." panel>
      <AuthBanner tone="error" reserve={Boolean(error)}>{error || null}</AuthBanner>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div key={session.id} className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div>
              <p className="font-medium">{session.device} · {session.browser}</p>
              <p className="text-sm text-muted-foreground">{session.status} · {new Date(session.createdAt).toLocaleString()}</p>
            </div>
            {session.status === "ACTIVE" ? (
              <button className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => revoke(session.id)}>Revoke</button>
            ) : null}
          </div>
        ))}
      </div>
    </AuthLayout>
  );
}
