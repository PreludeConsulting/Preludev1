export function sanitizeAuthRedirect(path, fallback = "/dashboard") {
  if (!path || typeof path !== "string") return fallback;
  try {
    const decoded = decodeURIComponent(path);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
    if (/^\/auth\/callback\b/.test(decoded)) return fallback;
    return decoded;
  } catch {
    return fallback;
  }
}
