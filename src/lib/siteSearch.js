import { NAV_LINKS } from "../data/navLinks.js";
import { landingRouteForTarget, parseLandingTarget, scrollToLandingTarget } from "./landingNavigation.js";

export const SCROLL_STORAGE_KEY = "preludeSearchScroll";

/** Searchable destinations — pages, tabs, and sections. */
export const SITE_SEARCH_ITEMS = [
  ...NAV_LINKS.map((link) => ({
    id: link.scrollTarget || (link.href.startsWith("#") ? link.href.slice(1) : link.href.replace(/^\//, "")),
    labelKey: link.labelKey,
    href: link.href,
    keywords: []
  })),
  {
    id: "financial-aid",
    labelKey: "nav.searchItems.financialAid",
    href: "/dashboard",
    scrollTarget: "roadmap-financial",
    keywords: ["aid", "scholarships", "fafsa", "css profile", "finances"]
  },
  {
    id: "college-list",
    labelKey: "nav.searchItems.collegeList",
    href: "/dashboard",
    scrollTarget: "roadmap-college-list",
    keywords: ["schools", "list", "colleges", "universities"]
  },
  {
    id: "application-strategy",
    labelKey: "nav.searchItems.applicationStrategy",
    href: "#how-it-works",
    keywords: ["strategy", "planning", "applications", "essays", "counseling"]
  },
  {
    id: "mentor-matching",
    labelKey: "nav.searchItems.mentorMatching",
    href: "/mentors",
    keywords: ["preludematch", "match", "mentors", "questionnaire"]
  }
];

export function filterSiteSearch(query, items, t) {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    const label = t(item.labelKey);
    const haystack = [label, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

/** Navigate to a search result and close the search panel. */
export function navigateToSiteResult(item, { pathname = window.location.pathname, navigate } = {}) {
  if (typeof navigate !== "function") return false;

  const landingTarget = parseLandingTarget(item.href);
  if (landingTarget.kind === "top") {
    if (pathname === "/") {
      if (window.location.hash) {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
      }
      scrollToLandingTarget(landingTarget.id);
    } else {
      navigate("/");
    }
    return true;
  }

  if (item.scrollTarget) sessionStorage.setItem(SCROLL_STORAGE_KEY, item.scrollTarget);

  if (item.href.startsWith("/")) {
    navigate(item.href);
    return true;
  }

  const hashId = item.href.replace(/^#/, "");
  if (pathname === "/" && window.location.hash === item.href) {
    scrollToLandingTarget(item.scrollTarget || hashId);
    return true;
  }
  navigate(landingRouteForTarget(item.href, pathname), { state: { landingScroll: true } });
  return true;
}

export function consumeSearchScrollTarget() {
  const target = sessionStorage.getItem(SCROLL_STORAGE_KEY);
  if (!target) return null;
  sessionStorage.removeItem(SCROLL_STORAGE_KEY);
  return target;
}
