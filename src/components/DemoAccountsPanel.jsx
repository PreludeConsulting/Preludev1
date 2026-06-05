import { DEMO_MENTOR, DEMO_STUDENT } from "../data/demoAccounts.js";

/**
 * Development-only quick login. Hidden in production builds (import.meta.env.PROD).
 */
export default function DemoAccountsPanel({ onDemoLogin, loading }) {
  if (import.meta.env.PROD) return null;

  return (
    <aside className="demo-accounts" aria-label="Development demo accounts">
      <p className="demo-accounts__label">Demo accounts · local development only</p>
      <p className="demo-accounts__hint">
        Database: <code className="demo-accounts__code">npm run db:start</code> then{" "}
        <code className="demo-accounts__code">npm run db:migrate</code> and{" "}
        <code className="demo-accounts__code">npm run seed:demo</code>.
      </p>
      <div className="demo-accounts__actions">
        <button
          type="button"
          className="demo-accounts__btn"
          disabled={loading}
          onClick={() => onDemoLogin(DEMO_STUDENT)}
        >
          Log in as Demo Student
        </button>
        <button
          type="button"
          className="demo-accounts__btn"
          disabled={loading}
          onClick={() => onDemoLogin(DEMO_MENTOR)}
        >
          Log in as Demo Mentor
        </button>
      </div>
    </aside>
  );
}
