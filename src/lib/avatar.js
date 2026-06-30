const OAUTH_AVATAR_HOSTS = [
  "googleusercontent.com",
  "lh3.googleusercontent.com",
  "accounts.google.com",
  "google.com"
];

function cleanUrl(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isOAuthAvatarUrl(value) {
  const url = cleanUrl(value);
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return OAUTH_AVATAR_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function getInitials(name, fallback = "P") {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((part) => part[0]).join("").toUpperCase();
  return initials || fallback;
}

export function resolveAvatarUrl({ profile, user, avatarUrl, oauthAvatarUrl } = {}) {
  const explicit = cleanUrl(avatarUrl);
  if (explicit && !isOAuthAvatarUrl(explicit)) return explicit;

  const profileUrl = cleanUrl(profile?.avatarUrl || profile?.avatar_url);
  if (profileUrl && !isOAuthAvatarUrl(profileUrl)) return profileUrl;

  const userUrl = cleanUrl(user?.avatarUrl || user?.avatar_url);
  if (userUrl && !isOAuthAvatarUrl(userUrl)) return userUrl;

  const oauthUrl = cleanUrl(oauthAvatarUrl || user?.oauthAvatarUrl || user?.oauthAvatar_url);
  if (oauthUrl) return oauthUrl;

  if (isOAuthAvatarUrl(profileUrl)) return profileUrl;
  if (isOAuthAvatarUrl(userUrl)) return userUrl;
  return "";
}

export function avatarUpdateEventDetail(avatarUrl) {
  return { avatarUrl: cleanUrl(avatarUrl) };
}

export function emitAvatarUpdated(avatarUrl) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("prelude:avatar-updated", { detail: avatarUpdateEventDetail(avatarUrl) }));
}
