import { DEMO_MENTOR, DEMO_PARENT, DEMO_STUDENT } from "../../data/demoAccounts.js";

export default function AuthDemoSection({ loading, activeAction, onDemo }) {
  return (
    <section className="auth-demo" aria-label="Demo accounts">
      <p className="auth-demo__label">Explore without signing up</p>
      <div className="auth-demo__actions">
        <button type="button" className="auth-demo__btn" disabled={loading} onClick={() => onDemo("student")}>
          {activeAction === "demo-student" ? "Opening…" : `Student · ${DEMO_STUDENT.firstName}`}
        </button>
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
