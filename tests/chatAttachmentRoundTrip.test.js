// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "sender-1/thread-a/1754400000000-photo.png";
const SIGNED_URL = `https://proj.supabase.co/storage/v1/object/sign/message-attachments/${STORAGE_KEY}?token=fresh`;

const SENDER = { id: "sender-1", name: "Student One", role: "student" };
const RECIPIENT = { id: "recipient-1", name: "Mentor One", role: "mentor" };
const THREAD = {
  id: "thread-a",
  chatType: "mentor_student",
  mentorId: RECIPIENT.id,
  studentId: SENDER.id
};

const db = { rows: [], insertError: null };
let signCalls = 0;

vi.mock("../src/lib/supabaseConfig.js", () => ({
  isSupabaseConfigured: () => true
}));

vi.mock("../src/lib/chatStorage.js", async () => {
  const actual = await vi.importActual("../src/lib/chatStorage.js");
  return {
    ...actual,
    createPrivateChatAttachmentUrl: vi.fn(async (value) => {
      if (!value || String(value).startsWith("data:")) return value || null;
      signCalls += 1;
      return `https://proj.supabase.co/storage/v1/object/sign/message-attachments/${value}?token=fresh`;
    })
  };
});

vi.mock("../src/lib/supabase.js", () => {
  function from() {
    const api = {
      insert(row) {
        api._pending = row;
        return api;
      },
      select() {
        return api;
      },
      eq() {
        return api;
      },
      order() {
        return Promise.resolve({ data: db.rows, error: null });
      },
      single() {
        if (db.insertError) return Promise.resolve({ data: null, error: db.insertError });
        const saved = { id: `db-${db.rows.length + 1}`, created_at: "2026-08-05T12:00:00.000Z", edited_at: null, ...api._pending };
        db.rows.push(saved);
        return Promise.resolve({ data: saved, error: null });
      }
    };
    return api;
  }
  return { getSupabase: () => ({ from }) };
});

const { loadChatMessages, sendChatMessage } = await import("../src/lib/chatService.js");

function stubStorage() {
  const map = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
      clear: () => map.clear()
    }
  });
}

const IMAGE = { url: SIGNED_URL, path: STORAGE_KEY, mime: "image/png", name: "photo.png", size: 4096 };

beforeEach(() => {
  db.rows = [];
  db.insertError = null;
  signCalls = 0;
  stubStorage();
});

describe("sending an attachment", () => {
  it("returns a renderable url to the sender straight away", async () => {
    const { message, error } = await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });

    expect(error).toBeNull();
    expect(message.attachmentUrl).toMatch(/^https:\/\//);
    expect(message.attachmentPath).toBe(STORAGE_KEY);
    expect(message.attachmentName).toBe("photo.png");
    expect(message.attachmentSize).toBe(4096);
  });

  it("stores the durable key, never a signed url, in the database row", async () => {
    await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });
    expect(db.rows[0].attachment_url).toBe(STORAGE_KEY);
    expect(db.rows[0].attachment_url).not.toMatch(/token=/);
  });

  it("keeps the sender's cached copy free of an expiring signed url", async () => {
    await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });
    const cached = JSON.parse(window.localStorage.getItem("prelude_chat_messages_thread-a"));
    expect(cached[0].attachment_path).toBe(STORAGE_KEY);
    expect(cached[0].attachment_url).toBeNull();
  });

  it("sends text alongside the attachment", async () => {
    const { message } = await sendChatMessage(SENDER, THREAD, { body: "see this", attachment: IMAGE });
    expect(message.body).toBe("see this");
    expect(message.attachmentUrl).toMatch(/^https:\/\//);
  });

  it("drops the cached row when the insert fails", async () => {
    db.insertError = { message: "insert denied" };
    const { message, error } = await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });

    expect(message).toBeNull();
    expect(error).toBe("insert denied");
    const cached = window.localStorage.getItem("prelude_chat_messages_thread-a");
    expect(JSON.parse(cached || "[]")).toHaveLength(0);
  });
});

describe("reloading a conversation with attachments", () => {
  it("shows the sender the image rather than a bare storage key", async () => {
    await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });

    const { messages } = await loadChatMessages(SENDER, THREAD);

    expect(messages).toHaveLength(1);
    expect(messages[0].attachmentUrl).toMatch(/^https:\/\//);
    expect(messages[0].attachmentUrl).not.toBe(STORAGE_KEY);
    expect(messages[0].attachmentPath).toBe(STORAGE_KEY);
  });

  it("gives the sender and the recipient the same attachment fields", async () => {
    await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });

    const sender = await loadChatMessages(SENDER, THREAD);
    stubStorage();
    const recipient = await loadChatMessages(RECIPIENT, THREAD);

    const a = sender.messages[0];
    const b = recipient.messages[0];
    expect(a.attachmentUrl).toBe(b.attachmentUrl);
    expect(a.attachmentName).toBe(b.attachmentName);
    expect(a.attachmentMime).toBe(b.attachmentMime);
    expect(a.isMine).toBe(true);
    expect(b.isMine).toBe(false);
  });

  it("re-signs on every read so an expired url is never rendered", async () => {
    await sendChatMessage(SENDER, THREAD, { body: "", attachment: IMAGE });
    const before = signCalls;

    await loadChatMessages(SENDER, THREAD);
    await loadChatMessages(SENDER, THREAD);

    expect(signCalls).toBeGreaterThan(before);
  });

  it("keeps several rapidly sent attachments renderable", async () => {
    await Promise.all([
      sendChatMessage(SENDER, THREAD, { body: "", attachment: { ...IMAGE, path: `${STORAGE_KEY}-1` } }),
      sendChatMessage(SENDER, THREAD, { body: "", attachment: { ...IMAGE, path: `${STORAGE_KEY}-2` } }),
      sendChatMessage(SENDER, THREAD, { body: "", attachment: { ...IMAGE, path: `${STORAGE_KEY}-3` } })
    ]);

    const { messages } = await loadChatMessages(SENDER, THREAD);

    expect(messages).toHaveLength(3);
    expect(messages.every((m) => /^https:\/\//.test(m.attachmentUrl || ""))).toBe(true);
  });
});
