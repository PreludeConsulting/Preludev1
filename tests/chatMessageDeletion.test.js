import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteAttachment = vi.fn();
const queryState = {
  owned: null,
  updated: null,
  lookupError: null,
  updateError: null,
  updates: [],
  filters: []
};

function queryBuilder() {
  let mode = "select";
  return {
    select() {
      return this;
    },
    update(payload) {
      mode = "update";
      queryState.updates.push(payload);
      return this;
    },
    eq(column, value) {
      queryState.filters.push([column, value]);
      return this;
    },
    is(column, value) {
      queryState.filters.push([column, value]);
      return this;
    },
    maybeSingle() {
      return mode === "update"
        ? Promise.resolve({ data: queryState.updated, error: queryState.updateError })
        : Promise.resolve({ data: queryState.owned, error: queryState.lookupError });
    }
  };
}

vi.mock("../src/lib/supabaseConfig.js", () => ({
  isSupabaseConfigured: () => true
}));

vi.mock("../src/lib/supabase.js", () => ({
  getSupabase: () => ({
    from: () => queryBuilder()
  })
}));

vi.mock("../src/lib/chatStorage.js", async () => {
  const actual = await vi.importActual("../src/lib/chatStorage.js");
  return {
    ...actual,
    deleteChatAttachment: deleteAttachment
  };
});

const { deleteChatMessage, mapChatMessage } = await import("../src/lib/chatService.js");

describe("deleteChatMessage", () => {
  const user = { id: "sender-1", role: "student" };
  const thread = { id: "thread-1", mentorId: "mentor-1", studentId: "sender-1" };

  beforeEach(() => {
    queryState.owned = { id: "message-1", attachment_url: "sender-1/thread-1/report.pdf" };
    queryState.updated = { id: "message-1" };
    queryState.lookupError = null;
    queryState.updateError = null;
    queryState.updates = [];
    queryState.filters = [];
    deleteAttachment.mockReset();
    deleteAttachment.mockResolvedValue({ error: null });
  });

  it("scrubs a sender-owned message and removes its stored attachment", async () => {
    await expect(deleteChatMessage(user, thread, "message-1")).resolves.toEqual({
      deletedId: "message-1",
      error: null
    });

    expect(queryState.updates[0]).toMatchObject({
      body: "",
      attachment_url: null,
      attachment_mime: null,
      attachment_name: null,
      attachment_size: null,
      deleted_by: "sender-1"
    });
    expect(queryState.filters).toContainEqual(["sender_id", "sender-1"]);
    expect(queryState.filters).toContainEqual(["chat_thread_id", "thread-1"]);
    expect(deleteAttachment).toHaveBeenCalledWith(user, "sender-1/thread-1/report.pdf");
  });

  it("does not delete a message the user does not own", async () => {
    queryState.owned = null;

    const result = await deleteChatMessage(user, thread, "message-2");

    expect(result.deletedId).toBeNull();
    expect(result.error).toMatch(/cannot delete/i);
    expect(queryState.updates).toHaveLength(0);
  });

  it("maps realtime deletion state", () => {
    expect(mapChatMessage({
      id: "message-1",
      sender_id: "sender-1",
      deleted_at: "2026-08-05T20:00:00.000Z"
    }, "mentor-1").deletedAt).toBe("2026-08-05T20:00:00.000Z");
  });
});

describe("message deletion migration", () => {
  const sql = readFileSync(
    new URL("../supabase/migrations/20260805220000_soft_delete_chat_messages.sql", import.meta.url),
    "utf8"
  );

  it("adds deletion metadata and an active-message index", () => {
    expect(sql).toMatch(/add column if not exists deleted_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists deleted_by uuid/i);
    expect(sql).toMatch(/where deleted_at is null/i);
  });

  it("allows only the sender to delete and requires content scrubbing", () => {
    expect(sql).toContain("Only the message sender may delete a message.");
    expect(sql).toContain("Deleted message content and attachments must be cleared.");
    expect(sql).toMatch(/new\.deleted_by is distinct from auth\.uid\(\)/i);
  });

  it("excludes deleted messages from previews and unread counts", () => {
    expect(sql.match(/message\.deleted_at is null/g)).toHaveLength(2);
  });
});
