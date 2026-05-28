import { useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { DEMO_HINT } from "../lib/auth.js";
import { PLAN_IDS, PLANS } from "../lib/plans.js";
import { cn } from "../lib/utils.js";

export default function SignInModal({ onSuccess }) {
  const { signInOpen, closeModals, signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState("signin");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    plan: "basic",
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
      if (mode === "signin") {
        await signIn(form.email, form.password);
      } else {
        await signUp(form);
      }
      onSuccess?.();
      if (mode === "signin" || mode === "signup") {
        window.location.hash = "dashboard";
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

        <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <>
              <label className="prelude-field">
                <span>Full name</span>
                <input type="text" required value={form.name} onChange={update("name")} autoComplete="name" />
              </label>
              <label className="prelude-field">
                <span>Your plan</span>
                <select value={form.plan} onChange={update("plan")}>
                  {PLAN_IDS.map((id) => (
                    <option key={id} value={id}>
                      {PLANS[id].name} — {PLANS[id].mentorSessions}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="prelude-field">
                  <span>I am a</span>
                  <select value={form.role} onChange={update("role")}>
                    <option value="student">Student</option>
                    <option value="parent">Parent / guardian</option>
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
              minLength={mode === "signup" ? 6 : 1}
              value={form.password}
              onChange={update("password")}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {authError ? <p className="text-sm text-accent">{authError}</p> : null}

          <button type="submit" className="prelude-btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p className="font-body text-xs leading-5 text-muted-foreground">{DEMO_HINT}</p>
        </form>
      </motion.div>
    </div>
  );
}
