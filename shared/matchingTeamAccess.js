/**
 * Matching Team access from profile/role alone.
 * Do not trust client-writable booleans (matching_team_access / is_matching_team).
 * Email allowlists are checked separately by server APIs.
 */
export function hasMatchingTeamAccess(userOrProfile) {
  if (!userOrProfile) return false;
  const role = String(userOrProfile.role || "").trim().toLowerCase();
  const systemRole = String(userOrProfile.systemRole || userOrProfile.system_role || "").trim().toLowerCase();
  return systemRole === "admin" || role === "admin";
}
