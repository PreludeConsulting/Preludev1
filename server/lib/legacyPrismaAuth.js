/**
 * Prisma/cookie JWT auth is legacy. Production defaults to Supabase-only unless
 * AUTH_LEGACY_PRISMA=1 is explicitly set.
 */
export function isLegacyPrismaAuthEnabled(env = process.env) {
  if (String(env.AUTH_LEGACY_PRISMA || "").trim() === "1") return true;
  return env.NODE_ENV !== "production";
}
