/**
 * Supabase browser client.
 *
 * This is part of an OPTIONAL, parallel Supabase auth stack that lives under
 * the `/auth/*` routes. It is intentionally isolated from the existing
 * Prisma/JWT auth system (src/lib/auth.js + /api/auth/*), which still powers
 * the current dashboard. Nothing here runs unless a `/auth/*` route is opened,
 * because every importer of this module is lazy-loaded.
 *
 * Only PUBLIC client credentials belong here:
 *   - VITE_SUPABASE_URL            (your project URL)
 *   - VITE_SUPABASE_PUBLISHABLE_KEY (publishable / anon key)
 *
 * NEVER put a service_role key, secret key, SMTP password, or any other
 * private credential in frontend code.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    [
      "Supabase is not configured.",
      "Add the following to your .env.local and restart `npm run dev`:",
      "  VITE_SUPABASE_URL=<your project URL>",
      "  VITE_SUPABASE_PUBLISHABLE_KEY=<your publishable/anon key>",
      "See SUPABASE_AUTH_SETUP.md for where to find these values."
    ].join("\n")
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
