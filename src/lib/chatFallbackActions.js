import { navigateChatHref } from "./chatLinkSecurity.js";

/** Mirrors server/preludeLinks.js and server/rag/fallback.js — keep in sync. */
export const CHAT_FALLBACK_LINKS = {
  open_plans: "#pricing",
  open_mentor_match: "/mentors",
  open_mentorship: "#how-it-works",
  sign_up: "/register",
  sign_in: "/login",
  open_dashboard: "#dashboard"
};

export const CLARIFY_PROMPT =
  "I'd like to share a bit more context about what I need help with.";

export function mapFallbackActionsToQuickReplies(fallback) {
  if (!fallback?.actions?.length) return [];

  return fallback.actions.map((item) => ({
    id: `fallback-${item.action}`,
    label: item.label,
    fallbackAction: item.action
  }));
}

export function navigateFallbackAction(action, navigationOptions) {
  const target = CHAT_FALLBACK_LINKS[action];
  if (!target) return false;
  return navigateChatHref(target, navigationOptions);
}

export function navigateChatAction(action, navigationOptions) {
  if (!action?.href) return false;
  return navigateChatHref(action.href, navigationOptions);
}
