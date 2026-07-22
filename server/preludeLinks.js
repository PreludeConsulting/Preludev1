/**
 * Verified Prelude website routes — discovered from src/App.jsx, Navbar, and Sections.
 * Hash routes are in-page anchors on the landing page. Path routes are separate auth pages.
 */
import { APP_ACTION_MAP, LANDING_SECTION_TARGETS, PUBLIC_APP_ROUTES } from "../shared/appRouteRegistry.js";

export const PRELUDE_LINKS = {
  home: PUBLIC_APP_ROUTES.home,
  plans: LANDING_SECTION_TARGETS.plans,
  mentorMatch: PUBLIC_APP_ROUTES.mentors,
  mentorship: LANDING_SECTION_TARGETS.mentorship,
  roadmap: LANDING_SECTION_TARGETS.roadmap,
  howItWorks: LANDING_SECTION_TARGETS.howItWorks,
  signUp: PUBLIC_APP_ROUTES.signUp,
  signIn: PUBLIC_APP_ROUTES.signIn,
  dashboard: PUBLIC_APP_ROUTES.dashboard,
  dashboardApp: PUBLIC_APP_ROUTES.dashboard,
  profile: PUBLIC_APP_ROUTES.profile,
  settings: PUBLIC_APP_ROUTES.settings,
  contact: LANDING_SECTION_TARGETS.contact,
  consultation: null,
  financialAidResources: null
};

export const PRELUDE_ACTION_DEFS = {
  explore_plans: { label: "Explore Plans", linkKey: "plans" },
  compare_plans: { label: "Compare Plans", linkKey: "plans" },
  find_mentor: { label: "Find a Mentor", linkKey: "mentorMatch" },
  mentor_matching: { label: "PreludeMatch", linkKey: "mentorMatch" },
  sign_up: { label: "Sign Up", linkKey: "signUp" },
  sign_in: { label: "Sign In", linkKey: "signIn" },
  open_dashboard: { label: "Open Dashboard", linkKey: "dashboard" },
  contact: { label: "Contact Prelude", linkKey: "contact" },
  how_it_works: { label: "How It Works", linkKey: "howItWorks" }
};

export function getPreludeLink(actionOrKey) {
  if (!actionOrKey) return null;
  const def = PRELUDE_ACTION_DEFS[actionOrKey];
  const key = def?.linkKey ?? actionOrKey;
  const href = PRELUDE_LINKS[key];
  return href ?? null;
}

export function preludeMarkdownLink(label, actionOrKey) {
  const href = getPreludeLink(actionOrKey);
  if (!href) return label;
  return `[${label}](${href})`;
}

export function buildVerifiedAction(actionId) {
  const def = PRELUDE_ACTION_DEFS[actionId];
  if (!def) return null;
  const href = APP_ACTION_MAP[actionId]?.target ?? getPreludeLink(def.linkKey);
  if (!href) return null;
  return {
    label: def.label,
    href,
    type: href.startsWith("http") ? "external" : "internal"
  };
}

export function buildVerifiedActions(actionIds = []) {
  const actions = [];
  const seen = new Set();
  for (const id of actionIds) {
    const action = buildVerifiedAction(id);
    if (!action || seen.has(action.href)) continue;
    seen.add(action.href);
    actions.push(action);
  }
  return actions;
}

export function joinMarkdownLinks(parts) {
  return parts.filter(Boolean).join(" · ");
}
