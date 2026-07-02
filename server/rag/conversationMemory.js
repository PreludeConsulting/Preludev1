import { sanitizeConversationHistory } from "./conversationHistory.js";
import { deriveSchoolConversationContext } from "./schoolConversation.js";
import { extractEntities } from "./entityExtraction.js";

function getRecentMessages(history = [], limit = 12) {
  return sanitizeConversationHistory(history).slice(-limit);
}

export function deriveConversationMemory(message, conversationHistory = [], profile = null, priorState = {}) {
  const schoolContext = deriveSchoolConversationContext(message, conversationHistory, priorState);
  const entities = extractEntities(message, {
    lastSchool: schoolContext.lastSchool ?? priorState.lastSchool,
    majors: priorState.majors,
    interests: priorState.interests,
    state: priorState.state,
    budget: priorState.budget,
    sat: priorState.sat,
    act: priorState.act,
    gpa: priorState.gpa,
    gradeLevel: priorState.gradeLevel
  });

  const profileMemory = {
    gpa: profile?.gpa ?? entities.gpa ?? priorState.gpa ?? null,
    sat: profile?.sat ?? entities.sat ?? priorState.sat ?? null,
    act: profile?.act ?? entities.act ?? priorState.act ?? null,
    majors: profile?.majors?.length ? profile.majors : entities.majors,
    interests: entities.interests,
    gradeLevel: profile?.grade ?? profile?.graduationYear ?? priorState.gradeLevel ?? null,
    budget: profile?.budget ?? profile?.financialAidNotes ?? entities.budget ?? priorState.budget ?? null,
    state: profile?.location ?? entities.state ?? priorState.state ?? null
  };

  return {
    ...priorState,
    ...schoolContext,
    ...profileMemory,
    lastSchool: schoolContext.lastSchool ?? priorState.lastSchool ?? null,
    lastSchoolName: schoolContext.lastSchool?.metadata?.name ?? priorState.lastSchoolName ?? null,
    schools: entities.schools,
    pendingIntent: schoolContext.pendingSchoolIntent ?? priorState.pendingIntent ?? null,
    pendingTopic: schoolContext.pendingSchoolTopic ?? priorState.pendingTopic ?? null,
    recentGoal: priorState.recentGoal ?? null
  };
}

export function updateMemoryFromClassification(memory, classification) {
  return {
    ...memory,
    lastIntent: classification.intentCategory,
    lastSubIntent: classification.subIntent ?? null,
    recentGoal: classification.intentCategory,
    majors: classification.entities?.majors?.length ? classification.entities.majors : memory.majors,
    interests: classification.entities?.interests?.length ? classification.entities.interests : memory.interests,
    lastSchool: classification.entities?.school ?? memory.lastSchool,
    lastSchoolName: classification.entities?.school?.metadata?.name ?? memory.lastSchoolName
  };
}
