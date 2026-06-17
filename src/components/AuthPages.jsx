import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboardData, getProfile, getSessions, requestPasswordReset, resetPassword, revokeSession, updateProfile, verifyEmail } from "../lib/auth.js";
import { dashboardHomeForRole } from "../lib/dashboardRoutes.js";
import { isDevAuthBypassEnabled } from "../lib/devAuthBypass.js";
import { postAuthDestination } from "../lib/onboardingRoutes.js";
import { signInWithGoogle } from "../lib/googleAuth.js";
import { isSupabaseConfigured } from "../lib/supabaseConfig.js";
import { ALL_DEMO_ACCOUNTS, DEMO_MENTOR, DEMO_STUDENT } from "../data/demoAccounts.js";
import { useAuth } from "../context/AuthContext.jsx";
import GoogleSignInButton from "../dashboard/components/GoogleSignInButton.jsx";
import AppLink from "./AppLink.jsx";

function Shell({ title, subtitle, children }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-foreground">
      <AppLink href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to Prelude</AppLink>
      <section className="mt-8 rounded-3xl border border-border/70 bg-card/90 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-muted-foreground">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
      </section>
    </main>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary" {...props} />
    </label>
  );
}

function Alert({ children, tone = "info" }) {
  const cls = tone === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-foreground";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInAsDemo, user, ready } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (isDevAuthBypassEnabled() && user) {
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
      const user = await signIn(demoEmail, demoPassword);
      navigate(postAuthDestination(user), { replace: true });
    } catch (err) {
      setError(err.message);
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
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Logging in…" : "Log in"}</button>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Or sign in with demo credentials: {ALL_DEMO_ACCOUNTS.map((account) => account.email).join(" · ")}
        </p>
      </div>
    </Shell>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const supabaseAuth = isSupabaseConfigured();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "STUDENT", termsAccepted: false });

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
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await signUp(form);
      if (result?.needsEmailConfirmation) {
        setMessage("Account created! Check your email and confirm your address, then log in.");
        return;
      }
      if (result?.id) {
        navigate(postAuthDestination(result), { replace: true });
        return;
      }
      setMessage(result?.message || "Account created.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Create your free Prelude account" subtitle="Choose Student or Mentor to access the right Prelude dashboard after sign-up.">
      <GoogleSignInButton label="Continue with Google" onClick={onGoogle} disabled={loading} loading={loading} />
      <p className="dash-auth-divider">or sign up with email</p>
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
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
        <label className="block text-sm font-medium">I am a
          <select className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3" value={form.role} onChange={update("role")}>
            <option value="STUDENT">Student</option>
            <option value="MENTOR">Mentor</option>
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1" type="checkbox" checked={form.termsAccepted} onChange={update("termsAccepted")} required /> I accept Prelude's terms and privacy requirements.</label>
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Creating…" : "Create account"}</button>
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

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (supabaseAuth) {
        const { resetPassword: supabaseReset } = await import("../lib/supabaseAuth.js");
        const { error: resetError } = await supabaseReset(email.trim());
        if (resetError) throw new Error(resetError);
        setMessage("If an account exists for that email, a password reset link is on its way.");
        return;
      }
      const result = await requestPasswordReset(email);
      setMessage(result.message);
    } catch (err) {
      setError(err.message);
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
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
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
  const navigate = useNavigate();
  const supabaseAuth = isSupabaseConfigured();
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get("token") || "");
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
      if (supabaseAuth) {
        if (password !== confirmPassword) {
          throw new Error("Passwords don't match.");
        }
        const { updatePassword: supabaseUpdate } = await import("../lib/supabaseAuth.js");
        const { error: updateError } = await supabaseUpdate(password);
        if (updateError) throw new Error(updateError);
        setMessage("Your password has been updated. Redirecting to login…");
        setTimeout(() => navigate("/login", { replace: true }), 1800);
        return;
      }
      const result = await resetPassword(token, password);
      setMessage(result.message);
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
          <Field label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <Field label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" subtitle="All existing sessions are revoked after reset.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        <Field label="Reset token" value={token} onChange={(e) => setToken(e.target.value)} required />
        <Field label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">Reset password</button>
      </form>
    </Shell>
  );
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState({ loading: true, message: "", error: "" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setState({
        loading: false,
        message: "",
        error: "This verification link is missing a token. Request a new link from your account settings or sign up again."
      });
      return;
    }

    let cancelled = false;
    verifyEmail(token)
      .then(async (result) => {
        if (cancelled) return;
        await refreshUser();
        setState({ loading: false, message: result.message || "Email verified.", error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, message: "", error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const continuePath = user ? postAuthDestination(user) : "/login";
  const continueLabel = user ? "Continue to dashboard" : "Continue to login";

  return (
    <Shell title="Email verification" subtitle="Confirm your email address for Prelude account updates.">
      {state.loading ? <Alert>Verifying your email…</Alert> : null}
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {!state.loading && !state.error && state.message ? <Alert>{state.message}</Alert> : null}
      {!state.loading && !state.error ? (
        <button
          type="button"
          className="mt-6 inline-block rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground"
          onClick={() => navigate(continuePath, { replace: true })}
        >
          {continueLabel}
        </button>
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
