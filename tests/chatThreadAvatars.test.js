import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  };
});

vi.mock("../src/lib/supabase.js", () => ({ getSupabase: () => null }));
vi.mock("../src/lib/supabaseConfig.js", () => ({ isSupabaseConfigured: () => false }));

import { DEMO_MENTOR, DEMO_STUDENT } from "../src/data/demoAccounts.js";
import { listChatThreadsForUser } from "../src/lib/chatService.js";
import { getDemoSessionUser } from "../src/lib/devAuthBypass.js";

describe("chat thread avatars", () => {
  beforeEach(() => {
    storage.clear();
    globalThis.localStorage = storage;
    globalThis.window = { localStorage: storage };
  });

  it("includes the demo mentor photo on Jordan student message threads", async () => {
    const user = getDemoSessionUser(DEMO_STUDENT.key);
    const { threads, error } = await listChatThreadsForUser(user);

    expect(error).toBeNull();
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      label: `${DEMO_MENTOR.firstName} ${DEMO_MENTOR.lastName}`,
      sublabel: "Your mentor",
      avatarUrl: DEMO_MENTOR.avatarUrl
    });
  });

  it("refreshes stale cached threads that were saved without an avatar", async () => {
    const user = getDemoSessionUser(DEMO_STUDENT.key);
    storage.setItem(
      `prelude_chat_threads_${user.id}`,
      JSON.stringify([
        {
          id: "demo-thread-ms-jordan",
          label: "Asim Yoonas",
          sublabel: "Your mentor",
          participantRole: "Mentor"
        }
      ])
    );

    const { threads } = await listChatThreadsForUser(user);
    expect(threads[0].avatarUrl).toBe(DEMO_MENTOR.avatarUrl);
  });
});
