import { resolveCollegesFromText } from "../datasets/collegeAliases.js";

export function parseCorrection(message, conversationState = {}) {
  const text = String(message ?? "").trim();
  const lower = text.toLowerCase();
  if (!lower) return null;

  const isCorrection =
    /\b(i said|i meant|not uga|not gt|not ucla|no,? i meant|you said|wrong school|meant .+ not)\b/i.test(
      lower
    ) || /\bnot\s+[a-z]{2,6}\b/i.test(lower);

  if (!isCorrection) return null;

  const removePatterns = [];
  const addPatterns = [];

  const notMatch = lower.match(/\b(?:not|instead of)\s+([a-z][a-z\s]{1,30}?)(?:\s*[,.]|$|\b(?:i|you|meant|said)\b)/i);
  if (notMatch) removePatterns.push(notMatch[1].trim());

  const meantMatch = text.match(/\b(?:i said|i meant|meant)\s+([a-z0-9][a-z0-9\s-]{1,30}?)(?:\s+not\b|\s*[,.]|$)/i);
  if (meantMatch) addPatterns.push(meantMatch[1].trim());

  const saidMatch = text.match(/\bsaid\s+([a-z0-9][a-z0-9\s-]{1,30}?)\s+not\b/i);
  if (saidMatch) addPatterns.push(saidMatch[1].trim());

  const removeSchools = [];
  for (const phrase of removePatterns) {
    removeSchools.push(...resolveCollegesFromText(phrase));
  }

  const addSchools = [];
  for (const phrase of addPatterns) {
    addSchools.push(...resolveCollegesFromText(phrase));
  }

  const removeIds = new Set(removeSchools.map((school) => school.unitid).filter(Boolean));
  let schools = [...(conversationState.schoolsUnderDiscussion ?? [])];

  if (removeIds.size) {
    schools = schools.filter((school) => !removeIds.has(school.unitid));
  }

  const merged = new Map(schools.map((school) => [school.unitid, school]));
  for (const school of addSchools) {
    if (school.unitid) merged.set(school.unitid, school);
  }

  if (!merged.size && addSchools.length) {
    for (const school of addSchools) {
      if (school.unitid) merged.set(school.unitid, school);
    }
  }

  return {
    isCorrection: true,
    removeUnitids: [...removeIds],
    schoolsUnderDiscussion: [...merged.values()],
    acknowledgment: buildCorrectionAcknowledgment(removeSchools, addSchools)
  };
}

function buildCorrectionAcknowledgment(removeSchools, addSchools) {
  const removed = removeSchools[0]?.aliasUsed ?? removeSchools[0]?.canonicalName;
  const added = addSchools[0]?.aliasUsed ?? addSchools[0]?.canonicalName;
  if (added && removed) {
    return `You're right — **${added.toUpperCase() === added ? added : added}**, not ${removed}.`;
  }
  if (added) return `You're right — **${added}**.`;
  return "You're right — let me correct that.";
}
