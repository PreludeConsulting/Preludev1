export const LANDING_TOP_ID = "home";

export function parseLandingTarget(target) {
  if (target === "/") return { kind: "top", id: LANDING_TOP_ID };
  if (typeof target === "string" && /^#[^#]+/.test(target)) {
    return { kind: "section", id: target.slice(1) };
  }
  return { kind: "route", id: null };
}

export function landingRouteForTarget(target, pathname) {
  const parsed = parseLandingTarget(target);
  if (parsed.kind === "top") return "/";
  if (parsed.kind === "section") return pathname === "/" ? target : `/${target}`;
  return target;
}

export function scrollToLandingTarget(id, { behavior = "smooth" } = {}) {
  if (typeof window === "undefined") return false;
  if (id === LANDING_TOP_ID) {
    window.scrollTo({ top: 0, left: 0, behavior });
    return true;
  }
  const element = document.getElementById(id);
  if (!element) return false;
  element.scrollIntoView({ behavior, block: "start" });
  return true;
}

