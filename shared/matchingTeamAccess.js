export function hasMatchingTeamAccess(userOrProfile) {
  if (!userOrProfile) return false;
  const role = String(userOrProfile.role || "").trim().toLowerCase();
  const systemRole = String(userOrProfile.systemRole || userOrProfile.system_role || "").trim().toLowerCase();
  return (
    userOrProfile.matchingTeamAccess === true ||
    userOrProfile.isMatchingTeam === true ||
    userOrProfile.matching_team_access === true ||
    userOrProfile.is_matching_team === true ||
    systemRole === "admin" ||
    role === "admin"
  );
}
