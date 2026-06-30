import { JORDAN_PLAN_DEMO_ACCOUNTS, DEMO_MENTOR, DEMO_PARENT } from "../../data/demoAccounts.js";

export default function AuthDemoSection({ loading, activeAction, onDemo }) {
  return (
    <section className="auth-demo" aria-label="Demo accounts">
      <p className="auth-demo__label">Explore without signing up</p>
      <div className="auth-demo__actions auth-demo__actions--plans">
        {JORDAN_PLAN_DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.key}
            type="button"
            className="auth-demo__btn"
            disabled={loading}
            onClick={() => onDemo(account.key)}
          >
            {activeAction === `demo-${account.key}`
              ? "Opening…"
              : `Jordan · ${account.plan.charAt(0).toUpperCase()}${account.plan.slice(1)}`}
          </button>
        ))}
      </div>
      <div className="auth-demo__actions">
        <button type="button" className="auth-demo__btn" disabled={loading} onClick={() => onDemo("mentor")}>
          {activeAction === "demo-mentor" ? "Opening…" : `Mentor · ${DEMO_MENTOR.firstName}`}
        </button>
        <button type="button" className="auth-demo__btn" disabled={loading} onClick={() => onDemo("parent")}>
          {activeAction === "demo-parent" ? "Opening…" : `Parent · ${DEMO_PARENT.firstName}`}
        </button>
      </div>
    </section>
  );
}
