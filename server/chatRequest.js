export const MAX_CHAT_MESSAGE_CHARS = 8_000;
export const MAX_CHAT_BODY_CHARS = 64_000;

function requestError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

export function validateChatRequestBody(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  let serialized = "";
  try {
    serialized = JSON.stringify(input);
  } catch {
    throw requestError(400, "INVALID_CHAT_REQUEST", "Chat request must be valid JSON.");
  }
  if (serialized.length > MAX_CHAT_BODY_CHARS) {
    throw requestError(413, "CHAT_REQUEST_TOO_LARGE", "Chat request is too large.");
  }

  if (input.mentorMatch && typeof input.mentorMatch === "object" && !Array.isArray(input.mentorMatch)) {
    return { kind: "mentor_match", mentorMatch: input.mentorMatch };
  }

  if (typeof input.message !== "string" || !input.message.trim()) return null;
  if (input.message.length > MAX_CHAT_MESSAGE_CHARS) {
    throw requestError(413, "CHAT_REQUEST_TOO_LARGE", "Chat message is too large.");
  }
  if (input.conversationHistory !== undefined && !Array.isArray(input.conversationHistory)) {
    throw requestError(400, "INVALID_CHAT_REQUEST", "Conversation history must be an array.");
  }
  return {
    kind: "message",
    message: input.message.trim(),
    conversationHistory: input.conversationHistory || [],
    profile: input.profile && typeof input.profile === "object" && !Array.isArray(input.profile)
      ? input.profile
      : null
  };
}
