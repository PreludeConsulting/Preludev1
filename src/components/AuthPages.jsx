import { CheckCircle2, Loader2, LockKeyhole, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getDashboardData, getProfile, getSessions, requestPasswordReset, revokeSession, updateProfile, verifyEmail } from "../lib/auth.js";
import { postAuthDestination } from "../lib/onboardingRoutes.js";
import { signInWithGoogle } from "../lib/googleAuth.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../dashboard/components/GoogleSignInButton.jsx";
import AppLink from "./AppLink.jsx";
import TurnstileWidget from "./auth/TurnstileWidget.jsx";
import AuthLayout from "./auth/AuthLayout.jsx";
import AuthDemoSection from "./auth/AuthDemoSection.jsx";
import AuthRoleSelector from "./auth/AuthRoleSelector.jsx";
import {
  AuthBanner,
  AuthDivider,
  AuthField,
  AuthInlineLink,
  AuthLegalAcknowledgment,
  AuthPasswordField,
  AuthSubmitButton,
  AuthTermsCheckbox,
  PasswordRequirements
} from "./auth/AuthForm.jsx";
import { friendlyAuthError, isValidEmail } from "./auth/authErrors.js";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "../../shared/passwordResetConstants.js";
import { isTurnstileRequired } from "../lib/turnstile.js";
import { sanitizeAuthRedirect } from "../lib/authRedirects.js";
import { sendLoginVerificationCode, verifyLoginCode } from "../lib/loginVerification.js";
export { default as ResetPasswordPage } from "./auth/ResetPasswordPage.jsx";

const SIGNUP_ROLE_VALUES = new Set(["STUDENT", "MENTOR", "PARENT"]);
const RESEND_COOLDOWN_SECONDS = 60;

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

function maskEmail(email) {
  if (!email || !email.includes("@")) return "";
  const [name, domain] = email.split("@");
  const visible = name.slice(0, 1);
  return `${visible}${"•".repeat(Math.min(Math.max(name.length - 1, 4), 8))}@${domain}`;
}

function friendlyVerificationError(error) {
  const code = error?.payload?.error || "";
  if (code === "cooldown") return error.message || "Please wait before requesting another code.";
  if (code === "rate_limited") return "Too many codes requested. Please wait and try again.";
  if (code === "email_delivery_failed") return "Prelude could not send the verification email. Please try again or contact support.";
  if (code === "login_verification_storage_missing") return error.message || "Prelude login verification storage is not configured yet. Ask an admin to run the Supabase login verification migration.";
  if (code === "expired_code") return "That code expired. Request a new one to continue.";
  if (code === "locked_challenge") return "Too many incorrect attempts. Request a new code.";
  if (code === "incorrect_code") return "That code is not correct. Check the email and try again.";
  if (code === "email_unconfirmed") return "Confirm your email address before completing login verification.";
  if (error?.status === 401) return "Your secure session expired. Sign in again to continue.";
  return error?.message || "Verification could not be completed.";
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
  const [message] = useState(() =>
    new URLSearchParams(location.search).get("reset") === "success"
      ? "Your password has been updated. Log in with your new password."
      : ""
  );
  const [authAction, setAuthAction] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const destination = sanitizeAuthRedirect(location.state?.from || new URLSearchParams(location.search).get("next") || "");
  const loading = Boolean(authAction);
  const googleLoading = authAction === "google";
  const emailLoading = authAction === "email";

  useEffect(() => {
    if (!ready) return;
    if (user) navigate(postAuthDestination(user), { replace: true });
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
    try {
      const nextUser = await signIn(loginEmail, loginPassword, { captchaToken });
      if (nextUser?.requiresLoginVerification) {
        const challenge = nextUser.challengeId ? `&challenge=${encodeURIComponent(nextUser.challengeId)}` : "";
        navigate(`/verify-login?next=${encodeURIComponent(destination || "/dashboard")}${challenge}`, { replace: true });
        return;
      }
      navigate(destination || postAuthDestination(nextUser), { replace: true });
    } catch (err) {
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

  async function continueAsDemo(accountKey) {
    setAuthAction(`demo-${accountKey}`);
    setFormError("");
    try {
      const nextUser = await signInAsDemo(accountKey);
      navigate(destination || postAuthDestination(nextUser), { replace: true });
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
  const invitedAsParent = searchParams.get("role") === "parent" || Boolean(parentInviteToken);
  const prefilledEmail = searchParams.get("email")?.trim() || "";
  const { signUp } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const destination = sanitizeAuthRedirect(location.state?.from || searchParams.get("next") || "");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: prefilledEmail,
    password: "",
    role: invitedAsParent ? "PARENT" : "",
    parentEmail: "",
    termsAccepted: false,
    parentInviteToken
  });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState("");
  const [authAction, setAuthAction] = useState("");
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
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
    if (resendCooldown <= 0) return undefined;
    const id = window.setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

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
    if (!invitedAsParent && !SIGNUP_ROLE_VALUES.has(form.role)) nextErrors.role = "Choose Student, Mentor, or Parent.";
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
      const role = invitedAsParent ? "PARENT" : form.role;
      const payload = {
        ...form,
        role,
        parentInviteToken: parentInviteToken || form.parentInviteToken,
        captchaToken
      };
      const result = await signUp(payload);
      if (result?.needsEmailConfirmation || result?.verificationEmailSent) {
        setConfirmationEmail(form.email.trim());
        setMessage(
          result?.message ||
            "Account created. We sent a confirmation link to your email. Please verify your address before logging in."
        );
        return;
      }
      if (result?.id) {
        navigate(postAuthDestination(result), { replace: true });
        return;
      }
      setMessage(result?.message || "Account created.");
    } catch (err) {
      const duplicate = /already exists|already registered|try logging in/i.test(err.message || "");
      if (supabaseAuth && duplicate) {
        setConfirmationEmail(form.email.trim());
        setMessage("An account with this email already exists. If it is not confirmed yet, resend the confirmation email; otherwise log in or reset your password.");
        setFormError("");
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
      const result = await resendSignupConfirmation(targetEmail);
      setMessage(result.message || "Confirmation email sent. Check your inbox.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
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
          : "Choose your role, verify your email, and start your Prelude dashboard."
      }
      headerLink={{ prefix: "Already have an account?", label: "Log in", href: "/login" }}
    >
      <GoogleSignInButton label="Sign up with Google" onClick={onGoogle} disabled={loading} loading={googleLoading} />
      <AuthDivider />
      {(formError || message) ? (
        <AuthBanner tone={formError ? "error" : "success"}>
          {formError || message}
        </AuthBanner>
      ) : null}
      {message ? (
        <div className="auth-inline-actions">
          {supabaseAuth ? (
            <button type="button" disabled={resending || resendCooldown > 0} onClick={resendConfirmationEmail}>
              {resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
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
        ) : (
          <AuthRoleSelector
            value={form.role}
            onChange={(role) => {
              setForm((current) => ({ ...current, role }));
              if (fieldErrors.role) setFieldErrors((current) => ({ ...current, role: "" }));
            }}
            disabled={loading}
            lockedRole={invitedAsParent ? "PARENT" : ""}
            error={fieldErrors.role}
          />
        )}
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
          disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken) || (!invitedAsParent && !form.role)}
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
  const { user, refreshUser } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const verificationUrl = useMemo(() => ({ search: window.location.search, hash: window.location.hash }), []);
  const verificationToken = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [state, setState] = useState({ loading: true, message: "", error: "", alreadyVerified: false });

  useEffect(() => {
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (supabaseAuth) {
      let cancelled = false;
      import("../lib/supabaseAuth.js")
        .then(({ completeEmailVerification }) => completeEmailVerification(verificationUrl.search, verificationUrl.hash))
        .then(async ({ user: nextUser, error }) => {
          if (cancelled) return;
          if (error) {
            setState({ loading: false, message: "", error: friendlyAuthError(error, "signup"), alreadyVerified: false });
            return;
          }
          await refreshUser();
          setState({
            loading: false,
            message: "Email verified. We're checking your Prelude profile before continuing.",
            error: "",
            alreadyVerified: false
          });
          const destination = postAuthDestination(nextUser);
          setTimeout(() => navigate(destination, { replace: true }), 900);
        })
        .catch((err) => {
          if (!cancelled) setState({ loading: false, message: "", error: friendlyAuthError(err.message, "signup"), alreadyVerified: false });
        });
      return () => {
        cancelled = true;
      };
    }

    if (!verificationToken) {
      setState({
        loading: false,
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
          loading: false,
          message: result.message || "Email verified.",
          error: "",
          alreadyVerified: Boolean(result.alreadyVerified)
        });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, message: "", error: friendlyAuthError(err.message, "signup"), alreadyVerified: false });
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser, supabaseAuth, verificationToken, verificationUrl.hash, verificationUrl.search, navigate]);

  const continuePath = user ? postAuthDestination(user) : "/login";
  const continueLabel = user ? "Continue to dashboard" : "Continue to login";

  return (
    <AuthLayout
      title="Email verification"
      subtitle="Confirm your email address so Prelude can protect account updates and recovery."
      headerLink={{ prefix: "Need help?", label: "Log in", href: "/login" }}
    >
      {state.loading ? (
        <div className="auth-inline-loading">
          <Loader2 className="auth-loading-spinner" aria-hidden="true" />
          <span>Verifying your email…</span>
        </div>
      ) : null}
      <AuthBanner tone="error" reserve={Boolean(state.error)}>
        {state.error || null}
      </AuthBanner>
      <AuthBanner tone="success" reserve={Boolean(!state.loading && !state.error && state.message)}>
        {!state.loading && !state.error && state.message ? state.message : null}
      </AuthBanner>
      {!state.loading && !state.error ? (
        <AuthSubmitButton type="button" onClick={() => navigate(continuePath, { replace: true })}>
          {continueLabel}
        </AuthSubmitButton>
      ) : null}
    </AuthLayout>
  );
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { beginLoginVerification, refreshUser } = useAuth();
  const processed = useRef(false);
  const callbackPromise = useRef(null);
  const callbackUrl = useMemo(() => ({ search: window.location.search, hash: window.location.hash }), []);
  const [state, setState] = useState({ loading: true, error: "", message: "Finishing Google sign-in…" });
  const nextPath = sanitizeAuthRedirect(searchParams.get("next") || "", "/dashboard");

  useEffect(() => {
    let active = true;
    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setState({
        loading: false,
        error: "We couldn't finish signing you in. Please try again.",
        message: ""
      });
    }, 20000);

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
        window.clearTimeout(timeoutId);
        if (error) {
          setState({ loading: false, error: friendlyAuthError(error, "signin"), message: "" });
          return;
        }
        const refreshed = await refreshUser();
        if (!active) return;
        const resolvedUser = nextUser || refreshed;
        const verification = await beginLoginVerification();
        if (!active) return;
        if (!verification.verified) {
          const challenge = verification.challengeId ? `&challenge=${encodeURIComponent(verification.challengeId)}` : "";
          navigate(`/verify-login?next=${encodeURIComponent(nextPath || "/dashboard")}${challenge}`, { replace: true });
          return;
        }
        const destination = nextPath === "/dashboard" ? postAuthDestination(resolvedUser) : nextPath || postAuthDestination(resolvedUser);
        setState({ loading: false, error: "", message: "Signed in. Opening Prelude…" });
        navigate(destination, { replace: true });
      })
      .catch((err) => {
        if (active) {
          window.clearTimeout(timeoutId);
          setState({ loading: false, error: friendlyAuthError(err.message, "signin"), message: "" });
        }
      });
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [beginLoginVerification, callbackUrl.hash, callbackUrl.search, navigate, nextPath, refreshUser]);

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
  const inputRefs = useRef([]);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [challengeId, setChallengeId] = useState(searchParams.get("challenge") || "");
  const [trustDevice, setTrustDevice] = useState(true);
  const [cooldown, setCooldown] = useState(60);
  const [status, setStatus] = useState("waiting");
  const [message, setMessage] = useState("We sent a six-digit code to your email.");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");
  const nextPath = sanitizeAuthRedirect(searchParams.get("next") || "", "/dashboard");
  const code = digits.join("");
  const loading = status === "sending" || status === "verifying" || status === "success";
  const maskedEmail = maskEmail(user?.email || "");

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate("/login", { replace: true, state: { from: nextPath } });
  }, [navigate, nextPath, ready, user]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (code.length !== 6 || loading || submittedCode === code) return;
    const id = window.setTimeout(() => {
      const form = inputRefs.current[0]?.form;
      form?.requestSubmit();
    }, 180);
    return () => window.clearTimeout(id);
  }, [code, loading, submittedCode]);

  function setCodeValue(value) {
    const next = value.replace(/\D/g, "").slice(0, 6).padEnd(6, " ").split("").map((char) => (/\d/.test(char) ? char : ""));
    setDigits(next);
    const nextIndex = Math.min(value.replace(/\D/g, "").length, 5);
    window.requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
  }

  function onDigitChange(index, value) {
    const clean = value.replace(/\D/g, "");
    if (clean.length > 1) {
      setCodeValue(clean);
      return;
    }
    setDigits((current) => {
      const next = [...current];
      next[index] = clean;
      return next;
    });
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function onKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  }

  async function onResend() {
    setStatus("sending");
    setError("");
    try {
      const result = await sendLoginVerificationCode();
      setChallengeId(result.challengeId || "");
      setDigits(["", "", "", "", "", ""]);
      setSubmittedCode("");
      setCooldown(Number(result.retryAfter || 60));
      setMessage(result.emailSent ? "A new verification code was sent." : "Prelude could not confirm email delivery. Please try again.");
      setStatus("waiting");
      window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
    } catch (err) {
      setStatus("delivery_failed");
      setError(friendlyVerificationError(err));
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (code.length !== 6 || loading) return;
    setStatus("verifying");
    setError("");
    setSubmittedCode(code);
    try {
      await verifyLoginCode({ challengeId, code, trustDevice });
      const verification = await refreshLoginVerification();
      const refreshed = await refreshUser();
      if (!verification.verified) throw new Error("Login verification could not be confirmed.");
      setStatus("success");
      setMessage("Verification successful. Opening your dashboard…");
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      navigate(nextPath === "/dashboard" ? postAuthDestination(refreshed) : nextPath, { replace: true });
    } catch (err) {
      setStatus(err?.payload?.error === "expired_code" ? "expired" : err?.payload?.error === "locked_challenge" ? "locked" : "incorrect");
      setError(friendlyVerificationError(err));
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      if (err?.payload?.error === "incorrect_code" || err?.payload?.error === "expired_code" || err?.payload?.error === "locked_challenge") {
        setDigits(["", "", "", "", "", ""]);
        window.requestAnimationFrame(() => inputRefs.current[0]?.focus());
      }
    }
  }

  return (
    <main className="verify-login-page">
      <section className={`verify-card${shake ? " verify-card--shake" : ""}${status === "success" ? " verify-card--success" : ""}`} aria-labelledby="verify-heading">
        <div className="verify-logo-wrap">
          <img src="/prelude-email-logo.png" alt="Prelude" className="verify-logo" />
        </div>
        <div className="verify-badge">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Secure sign-in
        </div>
        <h1 id="verify-heading" className="verify-title">Check your email</h1>
        <p className="verify-copy">
          We sent a six-digit code to <strong>{maskedEmail || "your confirmed email"}</strong>. Enter it below to finish signing in.
        </p>

        <form className="verify-form" onSubmit={onSubmit}>
          <fieldset className="verify-otp-fieldset">
            <legend className="sr-only">Six-digit verification code</legend>
            <p id="verify-code-help" className="sr-only">Enter the six digits from your Prelude verification email. Paste is supported.</p>
            <div
              className="verify-otp-row"
              aria-describedby="verify-code-help"
              onPaste={(event) => {
                event.preventDefault();
                setCodeValue(event.clipboardData.getData("text"));
              }}
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    inputRefs.current[index] = node;
                  }}
                  className="verify-otp-input"
                  value={digit}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  aria-label={`Verification code digit ${index + 1}`}
                  maxLength={1}
                  onChange={(event) => onDigitChange(index, event.target.value)}
                  onKeyDown={(event) => onKeyDown(index, event)}
                  onFocus={(event) => event.target.select()}
                />
              ))}
            </div>
          </fieldset>

          <button type="submit" disabled={loading || code.length !== 6} className="verify-submit">
            {status === "success" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : loading ? <span className="verify-spinner" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
            <span>{status === "success" ? "Verified" : status === "verifying" ? "Verifying code" : "Verify login"}</span>
          </button>

          <label className="verify-trust">
            <input type="checkbox" checked={trustDevice} onChange={(event) => setTrustDevice(event.target.checked)} />
            <span>
              <span>Trust this device for 30 days</span>
              <small>Skip verification codes on this browser. Do not use this on a shared device.</small>
            </span>
          </label>
        </form>

        <div className="verify-status" aria-live="polite">
          {error ? (
            <div className="verify-status__error">
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : (
            <span>{message}</span>
          )}
        </div>

        <div className="verify-actions">
          <button type="button" className="verify-link-button" disabled={loading || cooldown > 0} onClick={onResend}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
          <button type="button" className="verify-link-button" onClick={signOut}>Use another account</button>
        </div>
      </section>
    </main>
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
