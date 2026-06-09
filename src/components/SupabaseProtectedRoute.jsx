/**
 * Route guard for the optional Supabase auth stack.
 *
 * - Checks the current Supabase session on mount.
 * - Shows a loading state while checking.
 * - Redirects logged-out users to /auth/login.
 * - Keeps logged-in users signed in across refreshes (Supabase persists the
 *   session in localStorage and restores it).
 * - Listens for auth state changes and cleans up the subscription on unmount.
 *
 * This guard only protects pages under /auth/*. It does NOT touch the existing
 * /dashboard, which remains protected by the current Prisma/JWT RoleGuard.
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getSupabase } from "../lib/supabase.js";

export default function SupabaseProtectedRoute({ children, redirectTo = "/auth/login" }) {
  const [status, setStatus] = useState("loading"); // "loading" | "authed" | "guest"

  useEffect(() => {
    let active = true;

    getSupabase().auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setStatus(data.session ? "authed" : "guest");
      })
      .catch(() => {
        if (active) setStatus("guest");
      });

    const {
      data: { subscription }
    } = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setStatus(session ? "authed" : "guest");
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <p className="text-sm">Checking your session…</p>
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}
