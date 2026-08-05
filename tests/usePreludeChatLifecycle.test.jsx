// @vitest-environment happy-dom
import { act } from "react";
import { createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MENTOR = { id: "mentor-1", name: "Mentor One", role: "mentor" };
const STUDENT = { id: "student-1", name: "Student One", role: "student" };

const THREAD_A = { id: "thread-a", chatType: "mentor_student", mentorId: MENTOR.id, studentId: STUDENT.id };
const THREAD_B = { id: "thread-b", chatType: "mentor_student", mentorId: MENTOR.id, studentId: "student-2" };

const state = {
  threads: [THREAD_A],
  history: {},
  subscriptions: [],
  sendImpl: null
};

vi.mock("../src/dashboard/lib/notificationSounds.js", () => ({
  playIncomingMessageSound: vi.fn()
}));

vi.mock("../src/context/AuthContext.jsx", () => ({
  useAuth: () => ({ user: STUDENT })
}));

vi.mock("../src/lib/chatStorage.js", () => ({
  uploadChatAttachment: vi.fn(async () => ({ url: "https://example.test/x.png" })),
  validateChatImageFile: vi.fn(() => null)
}));

vi.mock("../src/lib/chatService.js", async () => {
  const actual = await vi.importActual("../src/lib/chatService.js");
  return {
    ...actual,
    listChatThreadsForUser: vi.fn(async () => ({ threads: state.threads, error: null })),
    loadChatMessages: vi.fn(async (_user, thread) => ({
      messages: state.history[thread.id] || [],
      error: null
    })),
    markChatThreadRead: vi.fn(async () => ({ updated: 0, error: null })),
    countUnreadChatMessages: vi.fn(() => 0),
    editChatMessage: vi.fn(async () => ({ message: null, error: null })),
    sendChatMessage: vi.fn(async (user, thread, payload) => state.sendImpl(user, thread, payload)),
    subscribeChatMessages: vi.fn((thread, onChange) => {
      const entry = { threadId: thread.id, onChange, active: true };
      state.subscriptions.push(entry);
      return () => {
        entry.active = false;
      };
    })
  };
});

const { playIncomingMessageSound } = await import("../src/dashboard/lib/notificationSounds.js");
const { mapChatMessage, MESSAGE_STATUS } = await import("../src/lib/chatService.js");
const { usePreludeChat } = await import("../src/dashboard/hooks/usePreludeChat.js");

function persistedRow(id, senderId, body, at = "2026-08-05T12:00:00.000Z") {
  return {
    id,
    chat_thread_id: THREAD_A.id,
    sender_id: senderId,
    receiver_id: senderId === STUDENT.id ? MENTOR.id : STUDENT.id,
    body,
    read: false,
    created_at: at
  };
}

async function renderChat() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const ref = { current: null, renders: 0 };

  function Harness() {
    const chat = usePreludeChat({ enabled: true });
    ref.current = chat;
    useEffect(() => {
      ref.renders += 1;
    });
    return null;
  }

  await act(async () => {
    root.render(createElement(Harness));
  });
  await act(async () => {});

  return {
    ref,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  };
}

function activeSubscriptions(threadId) {
  return state.subscriptions.filter((s) => s.active && (!threadId || s.threadId === threadId));
}

async function emit(threadId, row) {
  const targets = activeSubscriptions(threadId);
  await act(async () => {
    await Promise.all(targets.map((s) => s.onChange({ source: "realtime", event: "INSERT", row })));
  });
}

beforeEach(() => {
  state.threads = [THREAD_A];
  state.history = { [THREAD_A.id]: [] };
  state.subscriptions = [];
  state.sendImpl = async (user, thread, payload) => ({
    message: mapChatMessage(
      {
        ...persistedRow("db-sent", user.id, payload.body),
        client_id: payload.clientId,
        status: MESSAGE_STATUS.SENT
      },
      user.id
    ),
    clientId: payload.clientId,
    error: null
  });
  window.localStorage?.clear?.();
  playIncomingMessageSound.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sending a message", () => {
  it("shows one pending bubble and swaps it for the persisted row", async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const base = state.sendImpl;
    state.sendImpl = async (...args) => {
      await gate;
      return base(...args);
    };

    const { ref, unmount } = await renderChat();

    let pending;
    await act(async () => {
      pending = ref.current.sendMessage({ body: "hello there" });
    });

    expect(ref.current.messages).toHaveLength(1);
    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.SENDING);
    const clientId = ref.current.messages[0].clientId;
    expect(clientId).toBeTruthy();

    await act(async () => {
      release();
      await pending;
    });

    expect(ref.current.messages).toHaveLength(1);
    expect(ref.current.messages[0].id).toBe("db-sent");
    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.SENT);
    expect(ref.current.messages[0].createdAt).toBe("2026-08-05T12:00:00.000Z");
    expect(playIncomingMessageSound).not.toHaveBeenCalled();

    await unmount();
  });

  it("keeps both bubbles when the same text is sent twice", async () => {
    let counter = 0;
    state.sendImpl = async (user, thread, payload) => {
      counter += 1;
      return {
        message: mapChatMessage(
          {
            ...persistedRow(`db-${counter}`, user.id, payload.body, `2026-08-05T12:00:0${counter}.000Z`),
            client_id: payload.clientId,
            status: MESSAGE_STATUS.SENT
          },
          user.id
        ),
        clientId: payload.clientId,
        error: null
      };
    };

    const { ref, unmount } = await renderChat();
    await act(async () => {
      await ref.current.sendMessage({ body: "same" });
    });
    await act(async () => {
      await ref.current.sendMessage({ body: "same" });
    });

    expect(ref.current.messages.map((m) => m.id)).toEqual(["db-1", "db-2"]);
    await unmount();
  });

  it("marks the bubble failed and lets the user retry", async () => {
    state.sendImpl = async () => ({ message: null, error: "insert denied" });

    const { ref, unmount } = await renderChat();
    await act(async () => {
      await ref.current.sendMessage({ body: "nope" });
    });

    expect(ref.current.messages).toHaveLength(1);
    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.FAILED);
    expect(ref.current.error).toBe("insert denied");
    const clientId = ref.current.messages[0].clientId;

    state.sendImpl = async (user, thread, payload) => ({
      message: mapChatMessage(
        { ...persistedRow("db-retry", user.id, payload.body), client_id: payload.clientId },
        user.id
      ),
      clientId: payload.clientId,
      error: null
    });

    await act(async () => {
      await ref.current.retryMessage(clientId);
    });

    expect(ref.current.messages).toHaveLength(1);
    expect(ref.current.messages[0].id).toBe("db-retry");
    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.SENT);
    await unmount();
  });

  it("fails a send that never resolves instead of leaving it pending forever", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    state.sendImpl = () => new Promise(() => {});

    const { ref, unmount } = await renderChat();

    let pending;
    await act(async () => {
      pending = ref.current.sendMessage({ body: "stuck" });
    });
    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.SENDING);

    await act(async () => {
      vi.advanceTimersByTime(21000);
      await pending;
    });

    expect(ref.current.messages[0].status).toBe(MESSAGE_STATUS.FAILED);
    await unmount();
  });
});

describe("realtime delivery", () => {
  it("adds an incoming message once and plays exactly one sound", async () => {
    const { ref, unmount } = await renderChat();

    await emit(THREAD_A.id, persistedRow("db-in", MENTOR.id, "hi student"));

    expect(ref.current.messages.map((m) => m.id)).toEqual(["db-in"]);
    expect(playIncomingMessageSound).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("ignores duplicate realtime events for the same row", async () => {
    const { ref, unmount } = await renderChat();
    const row = persistedRow("db-in", MENTOR.id, "hi student");

    await emit(THREAD_A.id, row);
    await emit(THREAD_A.id, row);
    await emit(THREAD_A.id, { ...row });

    expect(ref.current.messages).toHaveLength(1);
    expect(playIncomingMessageSound).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("stays silent and adds nothing for the sender's own realtime echo", async () => {
    const { ref, unmount } = await renderChat();

    await act(async () => {
      await ref.current.sendMessage({ body: "mine" });
    });
    playIncomingMessageSound.mockClear();

    await emit(THREAD_A.id, persistedRow("db-sent", STUDENT.id, "mine"));

    expect(ref.current.messages).toHaveLength(1);
    expect(playIncomingMessageSound).not.toHaveBeenCalled();
    await unmount();
  });

  it("does not play a sound for message history loaded on mount", async () => {
    state.history = { [THREAD_A.id]: [mapChatMessage(persistedRow("db-old", MENTOR.id, "older"), STUDENT.id)] };

    const { ref, unmount } = await renderChat();

    expect(ref.current.messages).toHaveLength(1);
    expect(playIncomingMessageSound).not.toHaveBeenCalled();
    await unmount();
  });

  it("does not replay a sound when a refetch returns messages already shown", async () => {
    const { ref, unmount } = await renderChat();
    await emit(THREAD_A.id, persistedRow("db-in", MENTOR.id, "hi"));
    expect(playIncomingMessageSound).toHaveBeenCalledTimes(1);

    state.history = { [THREAD_A.id]: [mapChatMessage(persistedRow("db-in", MENTOR.id, "hi"), STUDENT.id)] };
    await act(async () => {
      await ref.current.refreshMessages({ silent: true });
    });

    expect(ref.current.messages).toHaveLength(1);
    expect(playIncomingMessageSound).toHaveBeenCalledTimes(1);
    await unmount();
  });
});

describe("subscription lifecycle", () => {
  it("keeps one active subscription per conversation", async () => {
    state.threads = [THREAD_A, THREAD_B];
    state.history = { [THREAD_A.id]: [], [THREAD_B.id]: [] };

    const { ref, unmount } = await renderChat();

    expect(activeSubscriptions(THREAD_A.id)).toHaveLength(1);
    expect(activeSubscriptions(THREAD_B.id)).toHaveLength(1);

    await act(async () => {
      ref.current.setActiveThreadId(THREAD_B.id);
    });
    await act(async () => {});

    expect(activeSubscriptions(THREAD_A.id)).toHaveLength(1);
    expect(activeSubscriptions(THREAD_B.id)).toHaveLength(1);

    await unmount();
  });

  it("does not resubscribe when the messages array changes", async () => {
    const { ref, unmount } = await renderChat();
    const created = state.subscriptions.length;

    await emit(THREAD_A.id, persistedRow("db-1", MENTOR.id, "one"));
    await emit(THREAD_A.id, persistedRow("db-2", MENTOR.id, "two"));
    await act(async () => {
      await ref.current.sendMessage({ body: "three" });
    });

    expect(state.subscriptions.length).toBe(created);
    await unmount();
  });

  it("tears every listener down on unmount", async () => {
    const { unmount } = await renderChat();
    expect(activeSubscriptions()).not.toHaveLength(0);
    await unmount();
    expect(activeSubscriptions()).toHaveLength(0);
  });
});

describe("page stability", () => {
  it("does not carry messages across a conversation switch", async () => {
    state.threads = [THREAD_A, THREAD_B];
    state.history = {
      [THREAD_A.id]: [mapChatMessage(persistedRow("db-a", MENTOR.id, "in a"), STUDENT.id)],
      [THREAD_B.id]: [
        mapChatMessage(
          { ...persistedRow("db-b", MENTOR.id, "in b"), chat_thread_id: THREAD_B.id },
          STUDENT.id
        )
      ]
    };

    const { ref, unmount } = await renderChat();
    expect(ref.current.messages.map((m) => m.id)).toEqual(["db-a"]);

    await act(async () => {
      ref.current.setActiveThreadId(THREAD_B.id);
    });
    await act(async () => {});

    expect(ref.current.messages.map((m) => m.id)).toEqual(["db-b"]);
    await unmount();
  });

  it("keeps the selected conversation while the list refreshes", async () => {
    state.threads = [THREAD_A, THREAD_B];
    state.history = { [THREAD_A.id]: [], [THREAD_B.id]: [] };

    const { ref, unmount } = await renderChat();
    await act(async () => {
      ref.current.setActiveThreadId(THREAD_B.id);
    });
    await act(async () => {});

    state.threads = [{ ...THREAD_A }, { ...THREAD_B }];
    await act(async () => {
      await ref.current.refreshMessages({ silent: true });
    });

    expect(ref.current.activeThreadId).toBe(THREAD_B.id);
    await unmount();
  });

  it("does not flip back into a loading state on background refreshes", async () => {
    const { ref, unmount } = await renderChat();
    expect(ref.current.loadingMessages).toBe(false);

    await act(async () => {
      await ref.current.refreshMessages({ silent: true });
    });

    expect(ref.current.loadingMessages).toBe(false);
    await unmount();
  });

  it("settles instead of re-rendering endlessly after a delivery", async () => {
    const { ref, unmount } = await renderChat();
    const before = ref.renders;

    await emit(THREAD_A.id, persistedRow("db-in", MENTOR.id, "hi"));
    await act(async () => {});

    expect(ref.renders - before).toBeLessThan(6);
    await unmount();
  });
});
