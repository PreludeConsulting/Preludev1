import { describe, expect, it } from "vitest";
import {
  createClientMessageId,
  isOptimisticMessageId,
  mapChatMessage,
  mergeMessagesById,
  MESSAGE_STATUS
} from "../src/lib/chatService.js";

const VIEWER = "student-1";

function persisted(id, overrides = {}) {
  return mapChatMessage(
    {
      id,
      sender_id: VIEWER,
      body: "hello",
      created_at: "2026-08-05T12:00:00.000Z",
      ...overrides
    },
    VIEWER
  );
}

describe("optimistic message identity", () => {
  it("gives every optimistic message a unique client id", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createClientMessageId()));
    expect(ids.size).toBe(200);
    expect([...ids].every(isOptimisticMessageId)).toBe(true);
  });

  it("marks optimistic rows as sending and persisted rows as sent", () => {
    const optimistic = mapChatMessage({ id: createClientMessageId(), sender_id: VIEWER }, VIEWER);
    expect(optimistic.status).toBe(MESSAGE_STATUS.SENDING);
    expect(persisted("db-1").status).toBe(MESSAGE_STATUS.SENT);
  });
});

describe("mergeMessagesById", () => {
  it("replaces the optimistic copy with the persisted row that carries its client id", () => {
    const clientId = createClientMessageId();
    const optimistic = mapChatMessage(
      { id: clientId, client_id: clientId, sender_id: VIEWER, body: "hi", created_at: "2026-08-05T12:00:00.000Z" },
      VIEWER
    );
    const saved = persisted("db-1", { client_id: clientId, body: "hi" });

    const merged = mergeMessagesById([optimistic], [saved]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("db-1");
    expect(merged[0].status).toBe(MESSAGE_STATUS.SENT);
  });

  it("ignores a persisted row that is already present (duplicate realtime or refetch)", () => {
    const saved = persisted("db-1");
    const merged = mergeMessagesById([saved], [saved, { ...saved }]);
    expect(merged).toHaveLength(1);
  });

  it("keeps two separate rows when the same text is sent twice on purpose", () => {
    const first = persisted("db-1", { body: "ok", created_at: "2026-08-05T12:00:00.000Z" });
    const second = persisted("db-2", { body: "ok", created_at: "2026-08-05T12:00:05.000Z" });
    const merged = mergeMessagesById([], [first, second]);
    expect(merged.map((m) => m.id)).toEqual(["db-1", "db-2"]);
  });

  it("never lets an optimistic row overwrite the persisted row it became", () => {
    const clientId = createClientMessageId();
    const optimistic = mapChatMessage({ id: clientId, client_id: clientId, sender_id: VIEWER }, VIEWER);
    const saved = persisted("db-1", { client_id: clientId });

    const merged = mergeMessagesById([saved], [optimistic]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("db-1");
    expect(merged[0].status).toBe(MESSAGE_STATUS.SENT);
  });

  it("orders the result by creation time", () => {
    const older = persisted("db-1", { created_at: "2026-08-05T11:00:00.000Z" });
    const newer = persisted("db-2", { created_at: "2026-08-05T12:00:00.000Z" });
    expect(mergeMessagesById([newer], [older]).map((m) => m.id)).toEqual(["db-1", "db-2"]);
  });

  it("produces unique React keys for every rendered message", () => {
    const rows = [
      persisted("db-1"),
      persisted("db-2"),
      mapChatMessage({ id: "local-a", client_id: "local-a", sender_id: VIEWER }, VIEWER)
    ];
    const merged = mergeMessagesById([], rows);
    expect(new Set(merged.map((m) => m.id)).size).toBe(merged.length);
  });
});
