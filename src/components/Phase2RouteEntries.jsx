import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { postAuthDestination } from "../lib/onboardingRoutes.js";
import PreludeMatch from "./hero/PreludeMatch.jsx";

function Loading() {
  return <main className="auth-page"><p role="status">Loading your Prelude session…</p></main>;
}

export function PublicPreludeMatchPage() {
  return (
    <main className="auth-page" data-testid="prelude-match-entry">
      <section className="auth-card">
        <p className="auth-eyebrow">PreludeMatch</p>
        <h1>Find the mentor who fits your next chapter.</h1>
        <p>Answer a few questions, review your match, and continue securely when you’re ready.</p>
        <a className="auth-submit" href="/onboarding/match">Start your match</a>
      </section>
      <PreludeMatch />
    </main>
  );
}

export function PreludeMatchEntry() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return user ? <Navigate to="/onboarding/match" replace /> : <PublicPreludeMatchPage />;
}

export function OnboardingEntry() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={`/prelude-match${location.search}`} replace state={{ from: location.pathname }} />;
  return <Navigate to={postAuthDestination(user)} replace />;
}

export function MatchAlias() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return <Navigate to={user ? "/onboarding/match" : "/prelude-match"} replace />;
}

export function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="auth-eyebrow">404</p>
        <h1>That Prelude page isn’t here.</h1>
        <p>Use the button below to return to a valid starting point.</p>
        <a className="auth-submit" href="/">Return home</a>
      </section>
    </main>
  );
}
