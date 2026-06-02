const TRUSTED_EXTERNAL_HOSTS = [
  "studentaid.gov",
  "www.studentaid.gov",
  "commonapp.org",
  "www.commonapp.org",
  "collegeboard.org",
  "www.collegeboard.org",
  "bigfuture.collegeboard.org",
  "collegescorecard.ed.gov",
  "ed.gov",
  "www.ed.gov"
];

const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

export function isBlockedHref(href) {
  const trimmed = String(href ?? "").trim();
  if (!trimmed || BLOCKED_PROTOCOLS.test(trimmed)) return true;
  return false;
}

export function isTrustedExternalUrl(href) {
  try {
    const url = new URL(trimmedHref(href));
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return TRUSTED_EXTERNAL_HOSTS.some((allowed) => {
      const bare = allowed.replace(/^www\./, "");
      return host === allowed || host === bare || host.endsWith(`.${bare}`);
    });
  } catch {
    return false;
  }
}

function trimmedHref(href) {
  return String(href ?? "").trim();
}

export function isInternalPreludeHref(href) {
  const value = trimmedHref(href);
  if (!value) return false;
  if (value.startsWith("#")) return /^#[a-z0-9-]+$/i.test(value);
  if (value.startsWith("/")) {
    return /^\/[a-z0-9./_-]*$/i.test(value) && !value.includes("..");
  }
  return false;
}

export function isAllowedChatHref(href) {
  const value = trimmedHref(href);
  if (!value || isBlockedHref(value)) return false;
  if (isInternalPreludeHref(value)) return true;
  if (/^https?:\/\//i.test(value)) return isTrustedExternalUrl(value);
  if (/^mailto:/i.test(value)) return /^mailto:[^\s]+$/i.test(value);
  return false;
}

export function sanitizeChatActions(actions = []) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => {
      const href = trimmedHref(action?.href);
      if (!href || !isAllowedChatHref(href)) return null;
      const type =
        action?.type === "external" || /^https?:\/\//i.test(href) ? "external" : "internal";
      return {
        label: String(action?.label ?? "").trim() || "Open",
        href,
        type
      };
    })
    .filter(Boolean);
}

export { TRUSTED_EXTERNAL_HOSTS };
