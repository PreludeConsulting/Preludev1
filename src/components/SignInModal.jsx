import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { signInWithGoogle } from "../lib/googleAuth.js";
import { postAuthDestination } from "../lib/onboardingRoutes.js";
import { cn } from "../lib/utils.js";
import GoogleSignInButton from "../dashboard/components/GoogleSignInButton.jsx";

export default function SignInModal({ onSuccess }) {
  const navigate = useNavigate();
  const { signInOpen, closeModals, signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "student",
    grade: "",
    focus: ""
  });

  if (!signInOpen) return null;

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let user;
      if (mode === "signin") {
        user = await signIn(form.email, form.password);
      } else {
        user = await signUp(form);
      }
      onSuccess?.(user);
      if (user) {
        navigate(postAuthDestination(user), { replace: true });
      }
    } catch {
      /* authError set in context */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prelude-modal-backdrop" role="presentation" onClick={closeModals}>
      <motion.div
        className="prelude-modal paper-card"
        role="dialog"
        aria-labelledby="signin-title"
        aria-modal="true"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-foreground/10 px-6 py-4">
          <div>
            <h2 id="signin-title" className="subheading text-3xl">
              {mode === "signin" ? "Sign in" : "Create account"}
            </h2>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              Access your plan, mentor benefits, and Prelude AI.
            </p>
          </div>
          <button type="button" className="rounded-full p-2 hover:bg-foreground/5" onClick={closeModals} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-foreground/10 px-6">
          {["signin", "signup"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "border-b-2 px-3 py-3 font-body text-sm font-medium transition",
                mode === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode(tab)}
            >
              {tab === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-6 py-5">
          <GoogleSignInButton
            disabled={loading}
            loading={loading}
            onClick={async () => {
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
            }}
          />
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <p className="dash-auth-divider">or use email</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label className="prelude-field">
                <span>Full name</span>
                <input type="text" required value={form.name} onChange={update("name")} autoComplete="name" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="prelude-field">
                  <span>I am a</span>
                  <select value={form.role} onChange={update("role")}>
                    <option value="student">Student</option>
                    <option value="mentor">Mentor</option>
                  </select>
                </label>
                <label className="prelude-field">
                  <span>Grade (optional)</span>
                  <input type="text" placeholder="e.g. 11" value={form.grade} onChange={update("grade")} />
                </label>
              </div>
              <label className="prelude-field">
                <span>Main focus</span>
                <input
                  type="text"
                  placeholder="e.g. essays, financial aid, college list"
                  value={form.focus}
                  onChange={update("focus")}
                />
              </label>
              <p className="font-body text-xs text-muted-foreground">By creating an account you accept Prelude's terms. Passwords must be 12+ characters with uppercase, lowercase, number, and symbol.</p>
            </>
          ) : null}

          <label className="prelude-field">
            <span>Email</span>
            <input type="email" required value={form.email} onChange={update("email")} autoComplete="email" />
          </label>
          <label className="prelude-field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={mode === "signup" ? 12 : 1}
              value={form.password}
              onChange={update("password")}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {authError ? <p className="text-sm text-accent">{authError}</p> : null}

          <button type="submit" className="prelude-btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

        </form>
        </div>
      </motion.div>
    </div>
  );
}
