/** Overlay regions (% of compact map) — upper/middle only, inset from edges. */
export const NETWORK_STAT_SAFE_ZONES = [
  { left: 6, top: 8, width: 22, height: 20 },
  { left: 64, top: 6, width: 22, height: 22 },
  { left: 34, top: 12, width: 20, height: 18 },
  { left: 8, top: 26, width: 24, height: 20 },
  { left: 58, top: 22, width: 24, height: 22 },
  { left: 30, top: 34, width: 22, height: 18 }
];

export const CALLOUT_CROSSFADE_MS = 450;
export const CALLOUT_CROSSFADE_OVERLAP_MS = 180;
export const CALLOUT_TYPING_STAGGER_MS = 36;
export const CALLOUT_TYPING_WORD_MS = 180;
/** Pause after typing finishes before switching to the next stat. */
export const CALLOUT_HOLD_AFTER_TYPE_MS = 5000;

/**
 * Pick a safe zone index different from the previous one.
 * @param {number} previousZoneIndex
 * @param {typeof NETWORK_STAT_SAFE_ZONES} [zones]
 */
export function pickCalloutZone(previousZoneIndex, zones = NETWORK_STAT_SAFE_ZONES) {
  if (!zones.length) return 0;
  if (zones.length === 1) return 0;

  let next = previousZoneIndex;
  let attempts = 0;

  while (next === previousZoneIndex && attempts < 12) {
    next = Math.floor(Math.random() * zones.length);
    attempts += 1;
  }

  return next === previousZoneIndex ? (previousZoneIndex + 1) % zones.length : next;
}

/**
 * Random top-left anchor within a safe zone (percent strings).
 * @param {typeof NETWORK_STAT_SAFE_ZONES[number]} zone
 * @param {() => number} [random]
 */
export function positionInZone(zone, random = Math.random) {
  const inset = 8;
  const maxLeft = zone.left + zone.width - inset;
  const maxTop = zone.top + zone.height - inset;
  const left = zone.left + inset + random() * Math.max(0, maxLeft - zone.left - inset);
  const top = zone.top + inset + random() * Math.max(0, maxTop - zone.top - inset);

  return {
    left: `${Math.min(left, 68).toFixed(2)}%`,
    top: `${Math.min(top, 52).toFixed(2)}%`
  };
}

/**
 * Build the next slot state for cycling callouts.
 * @param {number} statIndex
 * @param {number} previousZoneIndex
 * @param {() => number} [random]
 */
export function buildCalloutSlot(statIndex, previousZoneIndex, random = Math.random) {
  const zoneIndex = pickCalloutZone(previousZoneIndex, NETWORK_STAT_SAFE_ZONES);
  const position = positionInZone(NETWORK_STAT_SAFE_ZONES[zoneIndex], random);

  return {
    statIndex,
    zoneIndex,
    ...position
  };
}

/** Tokenize compact callout copy for typing animation. */
export function tokenizeCalloutRow(row) {
  const parts = [`${row.value}`, row.title, row.description];
  const tokens = [];

  parts.forEach((part, partIndex) => {
    if (partIndex > 0) tokens.push({ text: " ", isSpace: true });
    part.split(/(\s+)/).filter(Boolean).forEach((text) => {
      tokens.push({ text, isSpace: /^\s+$/.test(text) });
    });
  });

  return tokens;
}

/** Estimated typing duration for scheduling the post-type hold. */
export function estimateCalloutTypingMs(row) {
  const words = tokenizeCalloutRow(row).filter((token) => !token.isSpace);
  if (words.length === 0) return CALLOUT_TYPING_WORD_MS;
  return (words.length - 1) * CALLOUT_TYPING_STAGGER_MS + CALLOUT_TYPING_WORD_MS;
}
