// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendLocalChatMessage,
  removeLocalChatMessage,
  saveLocalChatMessages,
  subscribeLocalChatMessages
} from "../src/lib/localChatStore.js";

const THREAD = { id: "thread-a", chatType: "mentor_student", mentorId: "m1", studentId: "s1" };

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

function row(id, body) {
  return { id, sender_id: "m1", body, created_at: "2026-08-05T12:00:00.000Z" };
}

beforeEach(() => {
  stubStorage();
});

describe("local chat cache notifications", () => {
  it("does not notify subscribers for a silent cache write", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalChatMessages(THREAD, listener);

    saveLocalChatMessages(THREAD, [row("db-1", "hello")], { silent: true });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("does not notify when the cached payload is unchanged", () => {
    saveLocalChatMessages(THREAD, [row("db-1", "hello")], { silent: true });

    const listener = vi.fn();
    const unsubscribe = subscribeLocalChatMessages(THREAD, listener);
    saveLocalChatMessages(THREAD, [row("db-1", "hello")]);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("notifies once for a genuine local change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalChatMessages(THREAD, listener);

    appendLocalChatMessage(THREAD, row("db-1", "hello"));

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("drops a failed optimistic row without notifying when silent", () => {
    appendLocalChatMessage(THREAD, row("local-1", "pending"), { silent: true });

    const listener = vi.fn();
    const unsubscribe = subscribeLocalChatMessages(THREAD, listener);
    const remaining = removeLocalChatMessage(THREAD, "local-1", { silent: true });

    expect(remaining).toHaveLength(0);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocalChatMessages(THREAD, listener);
    unsubscribe();

    appendLocalChatMessage(THREAD, row("db-2", "later"));

    expect(listener).not.toHaveBeenCalled();
  });
});
