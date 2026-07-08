function timeOf(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isActiveDevice(device, now) {
  if (!device || device.revoked_at) return false;
  if (!device.expires_at) return true;
  return timeOf(device.expires_at) > now.getTime();
}

export function getTrustedDeviceFingerprint(device = {}) {
  return String(device.device_name || device.user_agent_summary || device.id || "trusted device")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatDate(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function normalizeDevice(device, { currentDeviceId = "" } = {}) {
  return {
    ...device,
    label: device.device_name || device.user_agent_summary || "Trusted device",
    browserOs: device.user_agent_summary || device.device_name || "Unknown browser",
    createdLabel: formatDate(device.created_at),
    lastUsedLabel: formatDate(device.last_used_at),
    expiresLabel: formatDate(device.expires_at),
    revokedLabel: formatDate(device.revoked_at),
    current: Boolean(currentDeviceId && device.id === currentDeviceId)
  };
}

export function getTrustedDeviceSections(devices = [], options = {}) {
  const now = options.now || new Date();
  const activeByFingerprint = new Map();
  const revoked = [];

  for (const raw of devices) {
    const device = normalizeDevice(raw, options);
    if (raw?.revoked_at) {
      revoked.push(device);
      continue;
    }
    if (!isActiveDevice(raw, now)) continue;

    const fingerprint = getTrustedDeviceFingerprint(raw);
    const existing = activeByFingerprint.get(fingerprint);
    if (!existing || timeOf(device.last_used_at || device.created_at) > timeOf(existing.last_used_at || existing.created_at)) {
      activeByFingerprint.set(fingerprint, device);
    }
  }

  return {
    active: [...activeByFingerprint.values()].sort((a, b) => timeOf(b.last_used_at || b.created_at) - timeOf(a.last_used_at || a.created_at)),
    revoked: revoked.sort((a, b) => timeOf(b.revoked_at) - timeOf(a.revoked_at))
  };
}
