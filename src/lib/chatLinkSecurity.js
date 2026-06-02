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

function trimHref(href) {
  return String(href ?? "").trim();
}

export function isBlockedHref(href) {
  const value = trimHref(href);
  if (!value || BLOCKED_PROTOCOLS.test(value)) return true;
  return false;
}

export function isTrustedExternalUrl(href) {
  try {
    const url = new URL(trimHref(href));
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

export function isInternalPreludeHref(href) {
  const value = trimHref(href);
  if (!value) return false;
  if (value.startsWith("#")) return /^#[a-z0-9-]+$/i.test(value);
  if (value.startsWith("/")) {
    return /^\/[a-z0-9./_-]*$/i.test(value) && !value.includes("..");
  }
  return false;
}

export function isAllowedChatHref(href) {
  const value = trimHref(href);
  if (!value || isBlockedHref(value)) return false;
  if (isInternalPreludeHref(value)) return true;
  if (/^https?:\/\//i.test(value)) return isTrustedExternalUrl(value);
  if (/^mailto:/i.test(value)) return /^mailto:[^\s]+$/i.test(value);
  return false;
}

export function navigateChatHref(href) {
  const value = trimHref(href);
  if (!isAllowedChatHref(value)) return false;

  if (value.startsWith("#")) {
    window.location.hash = value;
    return true;
  }

  if (value.startsWith("/")) {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
    const path = base && !value.startsWith(base) ? `${base}${value}` : value;
    window.location.href = path;
    return true;
  }

  if (/^https?:\/\//i.test(value)) {
    window.open(value, "_blank", "noopener,noreferrer");
    return true;
  }

  if (/^mailto:/i.test(value)) {
    window.location.href = value;
    return true;
  }

  return false;
}

export function sanitizeClientActions(actions = []) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((action) => {
      const href = trimHref(action?.href);
      if (!href || !isAllowedChatHref(href)) return null;
      return {
        label: String(action?.label ?? "").trim() || "Open",
        href,
        type: /^https?:\/\//i.test(href) ? "external" : "internal"
      };
    })
    .filter(Boolean);
}
