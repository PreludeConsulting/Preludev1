import { Loader2, ShieldCheck } from "lucide-react";
import AppLink from "./AppLink.jsx";

export default function AuthLoadingState({
  title = "Securing your Prelude session",
  message = "We are checking your account and preparing the next step.",
  tone = "default",
  showHomeLink = false
}) {
  return (
    <main className={`auth-loading-screen auth-loading-screen--${tone}`} aria-busy="true">
      <section className="auth-loading-card" aria-live="polite">
        <div className="auth-mark" aria-hidden="true">
          <img src="/prelude-email-logo.png" alt="" />
        </div>
        <div className="auth-status-pill">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Protected access
        </div>
        <Loader2 className="auth-loading-spinner" aria-hidden="true" />
        <h1>{title}</h1>
        <p>{message}</p>
        {showHomeLink ? (
          <AppLink href="/" className="auth-loading-link">
            Back to Prelude
          </AppLink>
        ) : null}
      </section>
    </main>
  );
}
