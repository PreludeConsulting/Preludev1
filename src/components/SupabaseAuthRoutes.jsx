/**
 * Lazy, isolated entry point for the optional Supabase auth stack (/auth/*).
 *
 * The Supabase client and pages are loaded ONLY when an /auth/* route is
 * visited. If VITE_SUPABASE_* env vars are missing, the lazy import throws and
 * the error boundary below shows a friendly setup message — without affecting
 * the landing pages or the existing Prisma/JWT dashboard.
 */

import { Component, Suspense, lazy } from "react";
import { Link } from "react-router-dom";

const SupabaseAuthApp = lazy(() => import("./SupabaseAuthPages.jsx"));

class SupabaseSetupBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto min-h-screen max-w-xl px-6 py-16 text-foreground">
          <Link to="/" className="text-sm text-muted-foreground transition hover:text-foreground">← Back to Prelude</Link>
          <section className="mt-8 rounded-3xl border border-destructive/30 bg-destructive/10 p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Supabase isn't configured yet</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Add your Supabase credentials to <code>.env.local</code> and restart <code>npm run dev</code>:
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-border bg-background/70 p-4 text-xs">
{`VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=`}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              See <code>SUPABASE_AUTH_SETUP.md</code> for where to find these values.
            </p>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function SupabaseAuthRoutes() {
  return (
    <SupabaseSetupBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-muted-foreground">
            <p className="text-sm">Loading…</p>
          </div>
        }
      >
        <SupabaseAuthApp />
      </Suspense>
    </SupabaseSetupBoundary>
  );
}
