/**
 * Supabase auth pages (optional parallel stack), mounted under /auth/*.
 *
 * Styling mirrors the existing Prelude auth pages (src/components/AuthPages.jsx)
 * so these feel native. This module is the lazy-loaded entry for the Supabase
 * stack — importing it is what initializes the Supabase client, so it never
 * runs on the landing pages or the existing dashboard.
 */

import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import {
  SELECTABLE_ROLES,
  getCurrentSession,
  getProfile,
  logIn,
  logOut,
  resetPassword,
  signUp,
  updatePassword
} from "../lib/supabaseAuth.js";
import { supabase } from "../lib/supabase.js";
import SupabaseProtectedRoute from "./SupabaseProtectedRoute.jsx";

function Shell({ title, subtitle, children }) {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-foreground">
      <Link to="/" className="text-sm text-muted-foreground transition hover:text-foreground">← Back to Prelude</Link>
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
      <input
        className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
        {...props}
      />
    </label>
  );
}

function Alert({ children, tone = "info" }) {
  const cls =
    tone === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "success"
        ? "border-emerald-500/30 bg-emerald-500/10 text-foreground"
        : "border-primary/30 bg-primary/10 text-foreground";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

function SubmitButton({ loading, children, loadingLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition disabled:opacity-60"
    >
      {loading ? loadingLabel : children}
    </button>
  );
}

function SupabaseLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error: loginError } = await logIn({ email: email.trim(), password });
    setLoading(false);
    if (loginError) {
      setError(loginError);
      return;
    }
    navigate("/auth/account", { replace: true });
  }

  return (
    <Shell title="Log in" subtitle="Sign in to your Prelude account.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <SubmitButton loading={loading} loadingLabel="Logging in…">Log in</SubmitButton>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" to="/auth/forgot-password">Forgot password?</Link> ·{" "}
          <Link className="underline" to="/auth/signup">Create an account</Link>
        </p>
      </form>
    </Shell>
  );
}

function SupabaseSignupPage() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "", role: "student" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError("Please fill in your name, email, and password.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (!SELECTABLE_ROLES.includes(form.role)) {
      setError("Please choose a valid role.");
      return;
    }

    setLoading(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      role: form.role
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }
    if (needsEmailConfirmation) {
      setMessage("Account created! Please check your email and confirm your address before logging in.");
    } else {
      setMessage("Account created! You can now log in.");
    }
  }

  return (
    <Shell title="Create your Prelude account" subtitle="Choose Student or Mentor to get the right experience.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <Field label="Full name" value={form.fullName} onChange={update("fullName")} required />
        <Field label="Email" type="email" autoComplete="email" value={form.email} onChange={update("email")} required />
        <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={update("password")} required minLength={6} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={update("confirmPassword")} required minLength={6} />
        <label className="block text-sm font-medium text-foreground">
          I am a
          <select
            className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:border-primary"
            value={form.role}
            onChange={update("role")}
          >
            <option value="student">Student</option>
            <option value="mentor">Mentor</option>
          </select>
        </label>
        <SubmitButton loading={loading} loadingLabel="Creating…">Create account</SubmitButton>
        <p className="text-sm text-muted-foreground">
          Already have an account? <Link className="underline" to="/auth/login">Log in</Link>
        </p>
      </form>
    </Shell>
  );
}

function SupabaseForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await resetPassword(email.trim());
    setLoading(false);
    if (resetError) {
      setError(resetError);
      return;
    }
    setMessage("If an account exists for that email, a password reset link is on its way.");
  }

  return (
    <Shell title="Reset password" subtitle="We'll email you a link to choose a new password.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <SubmitButton loading={loading} loadingLabel="Sending…">Send reset link</SubmitButton>
        <p className="text-sm text-muted-foreground">
          <Link className="underline" to="/auth/login">Back to login</Link>
        </p>
      </form>
    </Shell>
  );
}

function SupabaseResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let active = true;
    // The reset link establishes a session via detectSessionInUrl.
    getCurrentSession().then(({ session }) => {
      if (active) setHasRecoverySession(Boolean(session));
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasRecoverySession(Boolean(session));
    });
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!password) {
      setError("Please enter a new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setMessage("Your password has been updated. Redirecting to login…");
    setTimeout(() => navigate("/auth/login", { replace: true }), 1800);
  }

  return (
    <Shell title="Choose a new password" subtitle="Enter a new password for your account.">
      <form className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
        {!hasRecoverySession && !message ? (
          <Alert>
            Open this page from the reset link in your email. If you got here directly, request a new link on the{" "}
            <Link className="underline" to="/auth/forgot-password">forgot password</Link> page.
          </Alert>
        ) : null}
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
        <SubmitButton loading={loading} loadingLabel="Updating…">Update password</SubmitButton>
      </form>
    </Shell>
  );
}

function SupabaseAccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getCurrentSession().then(async ({ session }) => {
      if (!active || !session) return;
      setUser(session.user);
      const { profile: row, error: profileError } = await getProfile(session.user.id);
      if (!active) return;
      if (profileError) setError(profileError);
      else setProfile(row);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onLogout() {
    await logOut();
    navigate("/auth/login", { replace: true });
  }

  const role = profile?.role || user?.user_metadata?.role || "student";
  const fullName = profile?.full_name || user?.user_metadata?.full_name || "—";

  return (
    <Shell title="Your account" subtitle="This is a Supabase-protected sample page.">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!user ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
              <p className="mt-1 font-semibold">{fullName}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-1 font-semibold break-words">{user.email}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
              <p className="mt-1 font-semibold capitalize">{role}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Profile row</p>
              <p className="mt-1 font-semibold">{profile ? "Found in public.profiles" : "Not found yet"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-2xl border border-border px-5 py-3 font-semibold transition hover:bg-foreground/[0.04]"
          >
            Log out
          </button>
        </div>
      )}
    </Shell>
  );
}

export default function SupabaseAuthApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="login" replace />} />
      <Route path="login" element={<SupabaseLoginPage />} />
      <Route path="signup" element={<SupabaseSignupPage />} />
      <Route path="forgot-password" element={<SupabaseForgotPasswordPage />} />
      <Route path="reset-password" element={<SupabaseResetPasswordPage />} />
      <Route
        path="account"
        element={
          <SupabaseProtectedRoute>
            <SupabaseAccountPage />
          </SupabaseProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}
