export const PHASE2_PATHS = {
  match: "/prelude-match",
  onboarding: "/onboarding/match",
  dashboardOnboarding: "/dashboard/student/onboarding"
};

export function canonicalPhase2Path(pathname, authenticated = false) {
  if (pathname === "/match") return authenticated ? PHASE2_PATHS.onboarding : PHASE2_PATHS.match;
  if (pathname === "/onboarding" || pathname === PHASE2_PATHS.dashboardOnboarding) {
    return authenticated ? PHASE2_PATHS.onboarding : PHASE2_PATHS.match;
  }
  return pathname;
}
