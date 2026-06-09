/**
 * Maps a Supabase session + profile into the app user shape used by AuthContext
 * and the dashboard (matches attachFrontendFields from auth.js).
 */

import { getPlan } from "./plans.js";

export function mapSupabaseUser(session, profile = null) {
  if (!session?.user) return null;
  const u = session.user;
  const meta = u.user_metadata || {};
  const fullName = (profile?.full_name || meta.full_name || "").trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const role = (profile?.role || meta.role || "student").toLowerCase();
  const plan = getPlan("basic");
  return {
    id: u.id,
    email: u.email,
    firstName: firstName || "Student",
    lastName: rest.join(" ") || "User",
    name: fullName || u.email,
    role,
    plan: "basic",
    planName: plan.name,
    emailVerified: Boolean(u.email_confirmed_at || session),
    authProvider: "supabase"
  };
}
