import { useEffect, useMemo, useState } from "react";
import { getDashboardData, getProfile, getSessions, requestPasswordReset, resetPassword, revokeSession, updateProfile, verifyEmail } from "../lib/auth.js";
import { useAuth } from "../context/AuthContext.jsx";

function Shell({ title, subtitle, children }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-foreground">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to Prelude</a>
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
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signIn(email, password);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Log in" subtitle="Secure access uses HTTP-only cookies, CSRF protection, and server-side role checks.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Logging in…" : "Log in"}</button>
        <p className="text-sm text-muted-foreground"><a className="underline" href="/forgot-password">Forgot password?</a> · <a className="underline" href="/register">Create an account</a></p>
      </form>
    </Shell>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "STUDENT", termsAccepted: false });
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
      await signUp(form);
      setMessage("Account created. Check your email for the verification link. In local development, the link appears in the server console for free.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell title="Create your free Prelude account" subtitle="No paid email, SMS, or identity provider is required for local startup operation.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert>{message}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" value={form.firstName} onChange={update("firstName")} required />
          <Field label="Last name" value={form.lastName} onChange={update("lastName")} required />
        </div>
        <Field label="Email" type="email" value={form.email} onChange={update("email")} required />
        <Field label="Password" type="password" value={form.password} onChange={update("password")} required minLength={12} />
        <label className="block text-sm font-medium">Role
          <select className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3" value={form.role} onChange={update("role")}>
            <option value="STUDENT">Student</option>
            <option value="MENTOR">Mentor</option>
            <option value="COUNSELOR">Counselor</option>
          </select>
        </label>
        <label className="flex items-start gap-3 text-sm text-muted-foreground"><input className="mt-1" type="checkbox" checked={form.termsAccepted} onChange={update("termsAccepted")} required /> I accept Prelude's terms and privacy requirements.</label>
        <button disabled={loading} className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Creating…" : "Create account"}</button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function onSubmit(event) {
    event.preventDefault();
    try {
      const result = await requestPasswordReset(email);
      setMessage(result.message);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return <Shell title="Reset password" subtitle="Reset links are one-time use and expire quickly."><form className="space-y-5" onSubmit={onSubmit}>{error ? <Alert tone="error">{error}</Alert> : null}{message ? <Alert>{message}</Alert> : null}<Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /><button className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Send reset link</button></form></Shell>;
}

export function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function onSubmit(event) {
    event.preventDefault();
    try {
      const result = await resetPassword(token, password);
      setMessage(result.message);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return <Shell title="Choose a new password" subtitle="All existing sessions are revoked after reset."><form className="space-y-5" onSubmit={onSubmit}>{error ? <Alert tone="error">{error}</Alert> : null}{message ? <Alert>{message}</Alert> : null}<Field label="Reset token" value={token} onChange={(e) => setToken(e.target.value)} required /><Field label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} /><button className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Reset password</button></form></Shell>;
}

export function VerifyEmailPage() {
  const [state, setState] = useState({ loading: true, message: "Verifying email…", error: "" });
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    verifyEmail(token).then((result) => setState({ loading: false, message: result.message, error: "" })).catch((err) => setState({ loading: false, message: "", error: err.message }));
  }, []);
  return <Shell title="Email verification">{state.error ? <Alert tone="error">{state.error}</Alert> : <Alert>{state.message}</Alert>} {!state.loading && !state.error ? <a className="mt-6 inline-block rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground" href="/login">Continue to login</a> : null}</Shell>;
}

export function DashboardPage() {
  const { user, ready } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ready && !user) window.location.href = "/login";
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
