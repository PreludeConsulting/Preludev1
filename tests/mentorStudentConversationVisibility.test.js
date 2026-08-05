import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

const supabaseMock = vi.hoisted(() => ({ client: null }));

vi.mock("../src/lib/supabase.js", () => ({ getSupabase: () => supabaseMock.client }));
vi.mock("../src/lib/supabaseConfig.js", () => ({ isSupabaseConfigured: () => true }));

import { listChatThreadsForUser } from "../src/lib/chatService.js";

const MIGRATION_SQL = readFileSync(
  fileURLToPath(
    new URL("../supabase/migrations/20260805120000_mentor_student_conversation_visibility.sql", import.meta.url)
  ),
  "utf8"
);

const STUDENT = {
  id: "student-a",
  role: "student",
  email: "student-a@example.com",
  name: "Student A",
  authProvider: "supabase"
};

const MENTOR = {
  id: "mentor-a",
  role: "mentor",
  email: "mentor-a@example.com",
  name: "Mentor A",
  authProvider: "supabase"
};

const SHARED_THREAD_ID = "thread-shared-1";

/** Minimal PostgREST-shaped stub: records every filter so tests can assert scoping. */
function createSupabaseStub({ rpc = {}, tables = {} } = {}) {
  const calls = { rpc: [], selects: [], inserts: [] };

  function builder(table) {
    const state = { table, filters: {} };
    const chain = {};
    const filterMethods = ["eq", "in", "is", "not", "neq", "limit", "order"];
    filterMethods.forEach((method) => {
      chain[method] = (...args) => {
        state.filters[method] = [...(state.filters[method] || []), args];
        return chain;
      };
    });
    chain.select = () => {
      calls.selects.push(state);
      return chain;
    };
    chain.insert = (payload) => {
      calls.inserts.push({ table, payload });
      return chain;
    };
    chain.maybeSingle = async () => ({ data: resolveTable(table, state), error: null });
    chain.single = async () => ({ data: resolveTable(table, state), error: null });
    chain.then = (onFulfilled) => Promise.resolve({ data: resolveTable(table, state), error: null }).then(onFulfilled);
    return chain;
  }

  function resolveTable(table, state) {
    const value = tables[table];
    return typeof value === "function" ? value(state) : value ?? null;
  }

  return {
    calls,
    from: (table) => builder(table),
    rpc: async (name, args) => {
      calls.rpc.push({ name, args });
      const handler = rpc[name];
      if (!handler) return { data: null, error: { message: `function ${name} does not exist` } };
      return typeof handler === "function" ? handler(args) : handler;
    }
  };
}

function conversationRow(overrides = {}) {
  return {
    id: SHARED_THREAD_ID,
    chatType: "mentor_student",
    mentorId: MENTOR.id,
    studentId: STUDENT.id,
    parentId: null,
    participantId: MENTOR.id,
    participantName: "Mentor A",
    participantAvatarUrl: "https://cdn.example.com/mentor-a.png",
    participantRole: "mentor",
    lastMessagePreview: null,
    lastMessageAt: null,
    unreadCount: 0,
    ...overrides
  };
}

describe("mentor↔student conversation visibility", () => {
  beforeEach(() => {
    storage.clear();
    globalThis.localStorage = storage;
    globalThis.window = { localStorage: storage };
    supabaseMock.client = null;
  });

  it("shows the assigned mentor to the student before any message is sent", async () => {
    supabaseMock.client = createSupabaseStub({
      rpc: { list_user_chat_threads: async () => ({ data: [conversationRow()], error: null }) }
    });

    const { threads, error } = await listChatThreadsForUser(STUDENT);

    expect(error).toBeNull();
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: SHARED_THREAD_ID,
      label: "Mentor A",
      sublabel: "Your mentor",
      participantRole: "Mentor",
      avatarUrl: "https://cdn.example.com/mentor-a.png",
      unreadCount: 0
    });
  });

  it("shows the assigned student to the mentor on the same conversation record", async () => {
    supabaseMock.client = createSupabaseStub({
      rpc: {
        list_user_chat_threads: async () => ({
          data: [
            conversationRow({
              participantId: STUDENT.id,
              participantName: "Student A",
              participantRole: "student",
              participantAvatarUrl: null,
              lastMessagePreview: "Hi mentor",
              lastMessageAt: "2026-08-05T12:00:00.000Z",
              unreadCount: 2
            })
          ],
          error: null
        })
      }
    });

    const { threads } = await listChatThreadsForUser(MENTOR);

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: SHARED_THREAD_ID,
      label: "Student A",
      sublabel: "Assigned student",
      participantRole: "Student",
      lastMessagePreview: "Hi mentor",
      lastMessageAt: "2026-08-05T12:00:00.000Z",
      unreadCount: 2
    });
  });

  it("falls back to the assignment relationship when the list RPC is unavailable", async () => {
    const stub = createSupabaseStub({
      rpc: {
        ensure_mentor_student_chat_thread: async ({ p_mentor_id, p_student_id }) => ({
          data: {
            id: SHARED_THREAD_ID,
            chat_type: "mentor_student",
            mentor_id: p_mentor_id,
            student_id: p_student_id
          },
          error: null
        })
      },
      tables: {
        mentor_matches: { mentor_id: MENTOR.id, mentor_name: "Mentor A" },
        profiles: { full_name: "Mentor A", role: "mentor", avatar_url: null }
      }
    });
    supabaseMock.client = stub;

    const { threads, error } = await listChatThreadsForUser(STUDENT);

    expect(error).toBeNull();
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe(SHARED_THREAD_ID);
    expect(stub.calls.rpc.map((call) => call.name)).toContain("ensure_mentor_student_chat_thread");
    expect(stub.calls.inserts).toHaveLength(0);
  });

  it("treats accepted and active assignments as current when listing the student's mentor", async () => {
    const stub = createSupabaseStub({
      rpc: {
        ensure_mentor_student_chat_thread: async () => ({
          data: { id: SHARED_THREAD_ID, chat_type: "mentor_student", mentor_id: MENTOR.id, student_id: STUDENT.id },
          error: null
        })
      },
      tables: {
        mentor_matches: { mentor_id: MENTOR.id, mentor_name: "Mentor A" },
        profiles: { full_name: "Mentor A", role: "mentor" }
      }
    });
    supabaseMock.client = stub;

    await listChatThreadsForUser(STUDENT);

    const matchSelect = stub.calls.selects.find((call) => call.table === "mentor_matches");
    expect(matchSelect.filters.in[0][1]).toEqual(["assigned", "accepted", "active"]);
  });

  it("scopes the mentor inbox to their own assignments", async () => {
    const stub = createSupabaseStub({
      rpc: {
        ensure_mentor_student_chat_thread: async () => ({
          data: { id: SHARED_THREAD_ID, chat_type: "mentor_student", mentor_id: MENTOR.id, student_id: STUDENT.id },
          error: null
        })
      },
      tables: {
        mentor_matches: [{ student_id: STUDENT.id, status: "assigned" }],
        profiles: { full_name: "Student A", role: "student" }
      }
    });
    supabaseMock.client = stub;

    const { threads } = await listChatThreadsForUser(MENTOR);

    expect(threads).toHaveLength(1);
    const matchSelect = stub.calls.selects.find((call) => call.table === "mentor_matches");
    expect(matchSelect.filters.eq).toContainEqual(["mentor_id", MENTOR.id]);
  });

  it("does not create a duplicate conversation when the list is refreshed", async () => {
    const stub = createSupabaseStub({
      rpc: { list_user_chat_threads: async () => ({ data: [conversationRow()], error: null }) }
    });
    supabaseMock.client = stub;

    const first = await listChatThreadsForUser(STUDENT);
    const second = await listChatThreadsForUser(STUDENT);

    expect(first.threads[0].id).toBe(second.threads[0].id);
    expect(stub.calls.inserts).toHaveLength(0);
  });

  it("reports no conversations for a student without an assignment", async () => {
    supabaseMock.client = createSupabaseStub({
      rpc: { list_user_chat_threads: async () => ({ data: [], error: null }) },
      tables: { mentor_matches: null }
    });

    const { threads, error } = await listChatThreadsForUser(STUDENT);

    expect(error).toBeNull();
    expect(threads).toEqual([]);
  });
});

describe("conversation migration", () => {
  it("creates the chat_threads table so migration-only environments have messaging", () => {
    expect(MIGRATION_SQL).toContain("create table if not exists public.chat_threads");
    expect(MIGRATION_SQL).toContain("chat_threads_mentor_student_uidx");
  });

  it("keeps conversation creation idempotent for a student-mentor pair", () => {
    expect(MIGRATION_SQL).toContain("on conflict (mentor_id, student_id) where chat_type = 'mentor_student'");
    expect(MIGRATION_SQL).toContain("do update set deactivated_at = null");
  });

  it("backfills conversations for assignments that already exist", () => {
    expect(MIGRATION_SQL).toContain("from public.mentor_matches as match");
    expect(MIGRATION_SQL).toContain("do nothing");
    expect(MIGRATION_SQL).toMatch(/status in \('assigned', 'accepted', 'active'\)/);
  });

  it("revokes access from a mentor who is no longer assigned", () => {
    expect(MIGRATION_SQL).toContain("not public.is_active_mentor_assignment(thread.mentor_id, p_student_id)");
    expect(MIGRATION_SQL).toContain("deactivated_at is null");
  });

  it("blocks writes into a conversation the sender is no longer part of", () => {
    expect(MIGRATION_SQL).toContain('create policy "Messages insertable by thread member sender"');
    expect(MIGRATION_SQL).toContain("or public.is_chat_thread_participant(chat_thread_id)");
  });

  it("lists conversations from the assignment, not from message history", () => {
    expect(MIGRATION_SQL).toContain("create or replace function public.list_user_chat_threads()");
    expect(MIGRATION_SQL).toContain("'unreadCount', coalesce(unread.total, 0)");
    expect(MIGRATION_SQL).toContain("left join lateral");
  });
});
