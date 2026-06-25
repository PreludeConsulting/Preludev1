import { GraduationCap, HeartHandshake, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getDashboardData, getProfile, getSessions, requestPasswordReset, resetPassword, revokeSession, updateProfile, verifyEmail } from "../lib/auth.js";
import { postAuthDestination } from "../lib/onboardingRoutes.js";
import { signInWithGoogle } from "../lib/googleAuth.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";
import { ALL_DEMO_ACCOUNTS, DEMO_MENTOR, DEMO_PARENT, DEMO_STUDENT } from "../data/demoAccounts.js";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../dashboard/components/GoogleSignInButton.jsx";
import AppLink from "./AppLink.jsx";
import TurnstileWidget from "./auth/TurnstileWidget.jsx";
import { isTurnstileRequired } from "../lib/turnstile.js";

const SIGNUP_ROLE_OPTIONS = [
  {
    value: "STUDENT",
    title: "Student",
    description: "Build your college roadmap, match with mentors, and manage applications.",
    Icon: GraduationCap
  },
  {
    value: "MENTOR",
    title: "Mentor",
    description: "Support students with your college experience and mentor profile.",
    Icon: HeartHandshake
  },
  {
    value: "PARENT",
    title: "Parent",
    description: "Follow your student's progress, calendar, and mentor updates.",
    Icon: Users
  }
];

function Shell({ title, subtitle, children }) {
  return (
    <main className="auth-page mx-auto min-h-screen max-w-3xl px-4 py-8 text-foreground sm:px-6 sm:py-16">
      <AppLink href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to Prelude</AppLink>
      <section className="auth-card mt-8 rounded-3xl border border-border/70 bg-card/90 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <h1 className="auth-title text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="auth-subtitle mt-2 text-muted-foreground">{subtitle}</p> : null}
        <div className="auth-content mt-8">{children}</div>
      </section>
    </main>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="auth-field block text-sm font-medium text-foreground">
      {label}
      <input className="auth-input mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary" {...props} />
    </label>
  );
}

function Alert({ children, tone = "info" }) {
  const cls = tone === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-foreground";
  return <div className={`auth-alert rounded-2xl border px-4 py-3 text-sm ${cls}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}>{children}</div>;
}

function RoleSelector({ value, onChange, disabled = false, lockedRole = "" }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-foreground">I am signing up as a…</legend>
      <div className="grid gap-3 sm:grid-cols-3">
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
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-background/70 hover:border-primary/30"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

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

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInAsDemo, user, ready } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      navigate(postAuthDestination(user), { replace: true });
    }
  }, [ready, user, navigate]);

  async function onGoogle() {
    setError("");
    setLoading(true);
    try {
      const { url, error: oauthError, message } = await signInWithGoogle();
      if (oauthError) {
        setError(oauthError);
        return;
      }
      if (url) {
        window.location.href = url;
        return;
      }
      setError(message || "Google sign-in did not return a redirect URL.");
    } catch (err) {
      console.error("Unexpected Google OAuth failure:", err);
      setError(err?.message || "Request failed. Check Supabase/Google OAuth settings.");
    } finally {
      setLoading(false);
    }
  }

  async function loginWithCredentials(demoEmail, demoPassword) {
    setLoading(true);
    setError("");
    try {
      const user = await signIn(demoEmail, demoPassword, { captchaToken });
      navigate(postAuthDestination(user), { replace: true });
    } catch (err) {
      setError(err.message);
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    await loginWithCredentials(email, password);
  }

  async function continueAsDemo(accountKey) {
    setLoading(true);
    setError("");
    try {
      const nextUser = await signInAsDemo(accountKey);
      navigate(postAuthDestination(nextUser), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title="Log in"
      subtitle={supabaseAuth ? "Sign in to your Prelude account." : "Secure access uses HTTP-only cookies, CSRF protection, and server-side role checks."}
    >
      <GoogleSignInButton onClick={onGoogle} disabled={loading} loading={loading} />
      <p className="dash-auth-divider">or continue with email</p>
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <button disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)} aria-busy={loading || undefined} className="auth-submit w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Logging in…" : "Log in"}</button>
        <p className="text-sm text-muted-foreground">
          <AppLink className="underline" href="/forgot-password">Forgot password?</AppLink> ·{" "}
          <AppLink className="underline" href="/register">Create an account</AppLink>
        </p>
      </form>

      <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-sm font-semibold text-foreground">Try a demo dashboard</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore Prelude as a student or mentor — calendar, messages, and dashboard tools with no account required.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => continueAsDemo("student")}
            className="rounded-2xl border border-primary/25 bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
          >
            {loading ? "Opening demo…" : `Student · ${DEMO_STUDENT.firstName} ${DEMO_STUDENT.lastName}`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => continueAsDemo("mentor")}
            className="rounded-2xl border border-primary/25 bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
          >
            {loading ? "Opening demo…" : `Mentor · ${DEMO_MENTOR.firstName} ${DEMO_MENTOR.lastName}`}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => continueAsDemo("parent")}
            className="rounded-2xl border border-primary/25 bg-background px-5 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
          >
            {loading ? "Opening demo…" : `Parent · ${DEMO_PARENT.firstName} ${DEMO_PARENT.lastName}`}
          </button>
        </div>
        <p className="mt-3 break-words text-xs text-muted-foreground">
          Or sign in with demo credentials: {ALL_DEMO_ACCOUNTS.map((account) => account.email).join(" · ")}
        </p>
      </div>
    </Shell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentInviteToken = searchParams.get("parentInvite") || "";
  const invitedAsParent = searchParams.get("role") === "parent" || Boolean(parentInviteToken);
  const prefilledEmail = searchParams.get("email")?.trim() || "";
  const { signUp } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: prefilledEmail,
    password: "",
    role: invitedAsParent ? "parent" : "STUDENT",
    parentEmail: "",
    termsAccepted: false,
    parentInviteToken
  });

  async function onGoogle() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { url, error: oauthError, message } = await signInWithGoogle();
      if (oauthError) {
        setError(oauthError);
        return;
      }
      if (url) {
        window.location.href = url;
        return;
      }
      setMessage(message || "Google sign-up will be available once OAuth is configured.");
    } catch (err) {
      console.error("Unexpected Google OAuth failure:", err);
      setError(err?.message || "Request failed. Check Supabase/Google OAuth settings.");
    } finally {
      setLoading(false);
    }
  }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const role = invitedAsParent ? "PARENT" : form.role;
      if (!role) {
        throw new Error("Please choose Student, Mentor, or Parent before creating your account.");
      }
      const passwordError = validateSignupPassword(form.password, supabaseAuth);
      if (passwordError) throw new Error(passwordError);
      if (!form.termsAccepted) throw new Error("You must accept Prelude's terms to create an account.");

      const payload = {
        ...form,
        role,
        parentInviteToken: parentInviteToken || form.parentInviteToken,
        captchaToken
      };
      const result = await signUp(payload);
      if (result?.needsEmailConfirmation || result?.verificationEmailSent) {
        setMessage(
          result?.message ||
            "Account created! We sent a verification link to your email. Please verify your address, then log in."
        );
        return;
      }
      if (result?.id) {
        navigate(postAuthDestination(result), { replace: true });
        return;
      }
      setMessage(result?.message || "Account created.");
    } catch (err) {
      setError(err.message);
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      title={invitedAsParent ? "Create your Prelude parent account" : "Create your free Prelude account"}
      subtitle={
        invitedAsParent
          ? "You've been invited to follow your student's college journey on Prelude."
          : "Choose your role, create your account, and verify your email to get started."
      }
    >
      <GoogleSignInButton label="Continue with Google" onClick={onGoogle} disabled={loading} loading={loading} />
      <p className="dash-auth-divider">or sign up with email</p>
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? (
          <>
            <Alert>{message}</Alert>
            <p className="text-sm text-muted-foreground">
              <AppLink className="underline" href="/login">Go to login</AppLink>
            </p>
          </>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={update("firstName")} required />
          <Field label="Last name" value={form.lastName} onChange={update("lastName")} required />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
        <Field label="Password" type="password" value={form.password} onChange={update("password")} required minLength={supabaseAuth ? 6 : 12} />
        {!supabaseAuth ? (
          <p className="text-xs text-muted-foreground">
            At least 12 characters with uppercase, lowercase, a number, and a symbol.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">At least 6 characters.</p>
        )}
        {invitedAsParent ? (
          <Alert>You&apos;ll continue as a parent account for this invitation.</Alert>
        ) : (
          <RoleSelector
            value={form.role}
            onChange={(role) => setForm((current) => ({ ...current, role }))}
            disabled={loading}
            lockedRole={invitedAsParent ? "PARENT" : ""}
          />
        )}
        <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1" type="checkbox" checked={form.termsAccepted} onChange={update("termsAccepted")} required /> I accept Prelude's terms and privacy requirements.</label>
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <button
          disabled={
            loading ||
            (supabaseAuth && isTurnstileRequired() && !captchaToken) ||
            (!invitedAsParent && !form.role)
          }
          aria-busy={loading || undefined}
          className="auth-submit w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-sm text-muted-foreground">
          Already have an account? <AppLink className="underline" href="/login">Log in</AppLink>
        </p>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const supabaseAuth = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (supabaseAuth) {
        const { resetPassword: supabaseReset } = await import("../lib/supabaseAuth.js");
        const { error: resetError } = await supabaseReset(email.trim(), captchaToken);
        if (resetError) throw new Error(resetError);
        setMessage("If an account exists for this email, a reset link has been sent.");
        return;
      }
      const result = await requestPasswordReset(email);
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Reset password" subtitle="We'll email you a link to choose a new password.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {supabaseAuth ? <TurnstileWidget ref={turnstileRef} onTokenChange={setCaptchaToken} disabled={loading} /> : null}
        <button disabled={loading || (supabaseAuth && isTurnstileRequired() && !captchaToken)} className="auth-submit w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-sm text-muted-foreground">
          <AppLink className="underline" href="/login">Back to login</AppLink>
        </p>
      </form>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const supabaseAuth = isSupabaseConfigured();
  const params = new URLSearchParams(window.location.search);
  const [token] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    if (!supabaseAuth) return undefined;
    let active = true;
    let unsubscribe = () => {};

    import("../lib/supabaseAuth.js").then(({ getCurrentSession, onAuthStateChange }) => {
      getCurrentSession().then(({ session }) => {
        if (active) setHasRecoverySession(Boolean(session));
      });
      const { data } = onAuthStateChange((_event, session) => {
        if (active) setHasRecoverySession(Boolean(session));
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [supabaseAuth]);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (password !== confirmPassword) {
        throw new Error("Passwords don't match.");
      }
      const passwordError = validateSignupPassword(password, supabaseAuth);
      if (passwordError) throw new Error(passwordError);

      if (supabaseAuth) {
        const { updatePassword: supabaseUpdate } = await import("../lib/supabaseAuth.js");
        const { error: updateError } = await supabaseUpdate(password);
        if (updateError) throw new Error(updateError);
        setMessage("Your password has been updated. You can log in with your new password.");
        return;
      }

      if (!token) {
        throw new Error("This reset link is missing a token. Request a new link from the forgot password page.");
      }

      const result = await resetPassword(token, password);
      setMessage(result.message || "Password reset. Please log in again.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (supabaseAuth) {
    return (
      <Shell title="Choose a new password" subtitle="Enter a new password for your account.">
        <form className="space-y-5" onSubmit={onSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {message ? <Alert>{message}</Alert> : null}
          {!hasRecoverySession && !message ? (
            <Alert>
              Open this page from the reset link in your email, or request a new link on the{" "}
              <AppLink className="underline" href="/forgot-password">forgot password</AppLink> page.
            </Alert>
          ) : null}
          <Field label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <Field label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
          <button disabled={loading || (!hasRecoverySession && !message)} className="auth-submit w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "Updating…" : "Update password"}
          </button>
          {message ? (
            <p className="text-sm text-muted-foreground">
              <AppLink className="underline" href="/login">Back to login</AppLink>
            </p>
          ) : null}
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" subtitle="All existing sessions are revoked after reset.">
      {!token && !message ? (
        <Alert tone="error">
          This reset link is invalid or incomplete. Request a new link on the{" "}
          <AppLink className="underline" href="/forgot-password">forgot password</AppLink> page.
        </Alert>
      ) : null}
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        {token ? (
          <>
            <Field label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} autoComplete="new-password" />
            <Field label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={12} autoComplete="new-password" />
            <p className="text-xs text-muted-foreground">
              At least 12 characters with uppercase, lowercase, a number, and a symbol.
            </p>
            <button disabled={loading || Boolean(message)} className="auth-submit w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
              {loading ? "Updating…" : "Reset password"}
            </button>
          </>
        ) : null}
        {message ? (
          <p className="text-sm text-muted-foreground">
            <AppLink className="underline" href="/login">Back to login</AppLink>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            <AppLink className="underline" href="/login">Back to login</AppLink>
          </p>
        )}
      </form>
    </Shell>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [state, setState] = useState({ loading: true, message: "", error: "", alreadyVerified: false });

  useEffect(() => {
    if (supabaseAuth) {
      setState({
        loading: false,
        message:
          "Check your inbox for the confirmation link from Prelude. After confirming, return here to log in.",
        error: "",
        alreadyVerified: false
      });
      return undefined;
    }

    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setState({
        loading: false,
        message: "",
        error: "This verification link is missing a token. Request a new link from your account settings or sign up again.",
        alreadyVerified: false
      });
      return undefined;
    }

    let cancelled = false;
    verifyEmail(token)
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
        if (!cancelled) {
          setState({ loading: false, message: "", error: err.message, alreadyVerified: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser, supabaseAuth]);

  const continuePath = user ? postAuthDestination(user) : "/login";
  const continueLabel = user ? "Continue to dashboard" : "Continue to login";

  return (
    <Shell title="Email verification" subtitle="Confirm your email address for Prelude account updates.">
      {state.loading ? <Alert>Verifying your email…</Alert> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {!state.loading && !state.error && state.message ? (
        <Alert>{state.alreadyVerified ? state.message : state.message}</Alert>
      ) : null}
      {!state.loading && !state.error ? (
        <button
          type="button"
          className="mt-6 inline-block rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
          onClick={() => navigate(continuePath, { replace: true })}
        >
          {supabaseAuth ? "Go to login" : continueLabel}
        </button>
      ) : null}
      {state.error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          <AppLink className="underline" href="/login">Back to login</AppLink>
        </p>
      ) : null}
    </Shell>
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
  }, [ready, user]);
  const cards = useMemo(() => {
    if (!data) return [];
    if (data.role === "STUDENT") return ["Profile", "College applications", "Essays", "Mentorship sessions", "Messages", "Notifications", "Progress tracking"];
    if (data.role === "MENTOR") return ["Assigned students", "Session notes", "Student progress"];
    if (data.role === "COUNSELOR") return ["Student roster", "Analytics", "Organization progress"];
    return ["Platform metrics", "User management", "Reports", "Security events"];
  }, [data]);
  return <Shell title="Dashboard" subtitle={user ? `Signed in as ${user.name} (${user.role})` : "Loading…"}>{error ? <Alert tone="error">{error}</Alert> : null}{!data ? <p>Loading dashboard…</p> : <div className="grid gap-4 sm:grid-cols-2">{cards.map((card) => <div key={card} className="rounded-2xl border border-border bg-background/70 p-5"><h2 className="font-semibold">{card}</h2><p className="mt-2 text-sm text-muted-foreground">Visible only after server-side RBAC and ownership checks.</p></div>)}</div>}</Shell>;
}

export function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { getProfile().then(setProfile).catch((err) => setError(err.message)); }, []);
  async function onSubmit(event) {
    event.preventDefault();
    const result = await updateProfile({ firstName: profile.user.firstName, lastName: profile.user.lastName });
    setProfile((current) => ({ ...current, user: result.user }));
    setMessage("Profile updated.");
  }
  return <Shell title="Profile">{error ? <Alert tone="error">{error}</Alert> : null}{message ? <Alert>{message}</Alert> : null}{profile ? <form className="space-y-5" onSubmit={onSubmit}><Field label="First name" value={profile.user.firstName} onChange={(e) => setProfile((p) => ({ ...p, user: { ...p.user, firstName: e.target.value } }))} /><Field label="Last name" value={profile.user.lastName} onChange={(e) => setProfile((p) => ({ ...p, user: { ...p.user, lastName: e.target.value } }))} /><button className="rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Save profile</button></form> : <p>Loading profile…</p>}</Shell>;
}

export function SettingsPage() {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const load = () => getSessions().then((result) => setSessions(result.sessions)).catch((err) => setError(err.message));
  useEffect(load, []);
  async function revoke(id) { await revokeSession(id); load(); }
  return <Shell title="Settings" subtitle="Manage active devices and revoke sessions.">{error ? <Alert tone="error">{error}</Alert> : null}<div className="space-y-3">{sessions.map((session) => <div key={session.id} className="flex items-center justify-between rounded-2xl border border-border p-4"><div><p className="font-medium">{session.device} · {session.browser}</p><p className="text-sm text-muted-foreground">{session.status} · {new Date(session.createdAt).toLocaleString()}</p></div>{session.status === "ACTIVE" ? <button className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => revoke(session.id)}>Revoke</button> : null}</div>)}</div></Shell>;
}
