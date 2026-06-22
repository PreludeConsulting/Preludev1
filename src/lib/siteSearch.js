import { appPath } from "./appPaths.js";
import { NAV_LINKS } from "../data/navLinks.js";

export const SCROLL_STORAGE_KEY = "preludeSearchScroll";

/** Searchable destinations — pages, tabs, and sections. */
export const SITE_SEARCH_ITEMS = [
  ...NAV_LINKS.map((link) => ({
    id: link.href.startsWith("#") ? link.href.slice(1) : link.href.replace(/^\//, ""),
    labelKey: link.labelKey,
    href: link.href,
    keywords: []
  })),
  {
    id: "financial-aid",
    labelKey: "nav.searchItems.financialAid",
    href: "#dashboard",
    scrollTarget: "roadmap-financial",
    keywords: ["aid", "scholarships", "fafsa", "css profile", "finances"]
  },
  {
    id: "college-list",
    labelKey: "nav.searchItems.collegeList",
    href: "#dashboard",
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
    href: "#preludematch",
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

function scrollToElement(id) {
  if (!id) return;
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** Navigate to a search result and close the search panel. */
export function navigateToSiteResult(item) {
  if (item.href.startsWith("/")) {
    window.location.href = appPath(item.href);
    return;
  }

  if (item.scrollTarget) {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, item.scrollTarget);
  }

  if (window.location.pathname !== appPath("/")) {
    window.location.href = appPath(`/${item.href}`);
    return;
  }

  const hashId = item.href.replace(/^#/, "");

  if (window.location.hash === item.href) {
    scrollToElement(item.scrollTarget || hashId);
    return;
  }

  const onHashChange = () => {
    window.removeEventListener("hashchange", onHashChange);
    if (!item.scrollTarget) scrollToElement(hashId);
  };

  window.addEventListener("hashchange", onHashChange);
  window.location.hash = hashId;
}

export function consumeSearchScrollTarget() {
  const target = sessionStorage.getItem(SCROLL_STORAGE_KEY);
  if (!target) return null;
  sessionStorage.removeItem(SCROLL_STORAGE_KEY);
  return target;
}
