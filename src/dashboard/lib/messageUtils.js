/** Normalize legacy demo messages and assign receipt status. */
export function normalizeMessage(raw, conversationId) {
  const body = raw.body ?? raw.text ?? "";
  const sender = raw.sender ?? (raw.senderId === "me" ? "me" : "them");
  let status = raw.status;
  if (sender === "me" && !status) status = "read";
  if (sender === "them") status = undefined;

  return {
    id: raw.id,
    conversationId: raw.conversationId ?? conversationId,
    senderId: sender,
    sender,
    body,
    text: body,
    createdAt: raw.createdAt,
    deliveredAt: raw.deliveredAt ?? null,
    readAt: raw.readAt ?? null,
    status
  };
}

export function createOutgoingMessage(conversationId, body) {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    conversationId,
    senderId: "me",
    sender: "me",
    body,
    text: body,
    createdAt: now,
    deliveredAt: null,
    readAt: null,
    status: "sending"
  };
}

export function advanceMessageStatus(msg, status, extra = {}) {
  const now = new Date().toISOString();
  return {
    ...msg,
    status,
    deliveredAt: status === "delivered" || status === "read" ? extra.deliveredAt ?? now : msg.deliveredAt,
    readAt: status === "read" ? extra.readAt ?? now : msg.readAt
  };
}
