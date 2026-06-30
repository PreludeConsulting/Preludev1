import { Loader2 } from "lucide-react";
import AppLink from "./AppLink.jsx";

export default function AuthLoadingState({
  title = "Securing your Prelude session",
  message = "We are checking your account and preparing the next step.",
  showHomeLink = false
}) {
  return (
    <main className="auth-loading-screen" aria-busy="true">
      <div className="auth-shell__backdrop" aria-hidden="true">
        <div className="auth-shell__orb auth-shell__orb--primary" />
        <div className="auth-shell__orb auth-shell__orb--secondary" />
        <div className="auth-shell__orb auth-shell__orb--accent" />
        <div className="auth-shell__grain" />
      </div>
      <section className="auth-loading-card" aria-live="polite">
        <AppLink href="/" className="auth-shell__logo" aria-label="Prelude home">
          <img src="/prelude-email-logo.png" alt="" width={40} height={40} />
        </AppLink>
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
