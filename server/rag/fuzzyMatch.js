export function levenshteinDistance(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

export function similarityScore(a, b) {
  const left = String(a ?? "").toLowerCase();
  const right = String(b ?? "").toLowerCase();
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

export function findBestFuzzyMatch(query, candidates, { threshold = 0.72, minLength = 3 } = {}) {
  const normalized = String(query ?? "").toLowerCase().trim();
  if (!normalized || normalized.length < minLength) return null;

  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const value = typeof candidate === "string" ? candidate : candidate.value;
    const label = typeof candidate === "string" ? candidate : candidate.label ?? candidate.value;
    const score = similarityScore(normalized, value);
    if (score > bestScore) {
      bestScore = score;
      best = { value: label, score, item: candidate };
    }
  }

  if (!best || bestScore < threshold) return null;
  return {
    ...best,
    confidence: bestScore >= 0.9 ? "high" : bestScore >= threshold ? "medium" : "low"
  };
}

export function tokenFuzzyIncludes(text, token, threshold = 0.8) {
  const words = String(text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.some((word) => similarityScore(word, token) >= threshold);
}
