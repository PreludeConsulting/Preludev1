/**
 * Executes the mentor↔student conversation migration against an in-process
 * Postgres (PGlite) and walks the assignment → Messages acceptance scenarios.
 *
 *   npm install --no-save @electric-sql/pglite
 *   node scripts/verify-chat-conversations.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.log("skipped: install @electric-sql/pglite to run this check");
  process.exit(0);
}

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20260805120000_mentor_student_conversation_visibility.sql", import.meta.url)),
  "utf8"
);

const MENTOR_A = "11111111-1111-1111-1111-111111111111";
const MENTOR_B = "22222222-2222-2222-2222-222222222222";
const MENTOR_C = "33333333-3333-3333-3333-333333333333";
const STUDENT_A = "44444444-4444-4444-4444-444444444444";

const db = new PGlite();
let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}

async function asUser(userId) {
  await db.query("select set_config('app.viewer_id', $1, false)", [userId ?? ""]);
}

async function listThreads(userId) {
  await asUser(userId);
  const { rows } = await db.query("select public.list_user_chat_threads() as threads");
  return rows[0].threads;
}

async function assign(studentId, mentorId, mentorName) {
  await db.query("delete from public.mentor_matches where student_id = $1", [studentId]);
  await db.query(
    `insert into public.mentor_matches (student_id, user_id, mentor_id, mentor_name, status)
     values ($1, $1, $2, $3, 'assigned')`,
    [studentId, mentorId, mentorName]
  );
  await asUser(null);
  await db.query("select public.ensure_mentor_student_chat_thread($1, $2)", [mentorId, studentId]);
}

async function bootstrapStubSchema() {
  await db.exec(`
    create role authenticated;
    create role service_role;
    create schema if not exists auth;

    create table auth.users (id uuid primary key);

    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.viewer_id', true), '')::uuid;
    $$;

    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      full_name text,
      role text,
      avatar_url text
    );

    create table public.mentor_matching_profiles (
      mentor_user_id uuid primary key references auth.users (id) on delete cascade,
      approved boolean default true,
      completed boolean default true
    );

    create table public.mentor_matches (
      id uuid primary key default gen_random_uuid(),
      student_id uuid,
      user_id uuid,
      mentor_id uuid,
      mentor_name text,
      status text not null default 'saved',
      created_at timestamptz not null default now()
    );

    create table public.messages (
      id uuid primary key default gen_random_uuid(),
      sender_id uuid,
      receiver_id uuid,
      user_id uuid,
      body text,
      attachment_name text,
      read boolean not null default false,
      created_at timestamptz not null default now()
    );

    create or replace function public.is_mentor_role(candidate uuid) returns boolean language sql stable as $$
      select exists (select 1 from public.profiles where id = candidate and role = 'mentor');
    $$;

    create or replace function public.is_authorized_chat_relationship(
      requested_chat_type text,
      requested_mentor_id uuid,
      requested_student_id uuid,
      requested_parent_id uuid
    ) returns boolean language sql stable as $$
      select requested_mentor_id is not null and requested_student_id is not null;
    $$;
  `);

  const people = [
    [MENTOR_A, "Mentor A", "mentor"],
    [MENTOR_B, "Mentor B", "mentor"],
    [MENTOR_C, "Mentor C", "mentor"],
    [STUDENT_A, "Student A", "student"]
  ];
  for (const [id, name, role] of people) {
    await db.query("insert into auth.users (id) values ($1)", [id]);
    await db.query("insert into public.profiles (id, full_name, role) values ($1, $2, $3)", [id, name, role]);
    if (role === "mentor") {
      await db.query("insert into public.mentor_matching_profiles (mentor_user_id) values ($1)", [id]);
    }
  }
}

console.log("mentor↔student conversation migration");
await bootstrapStubSchema();

async function applyMigration(label) {
  try {
    await db.exec(MIGRATION);
    check(label, true);
  } catch (error) {
    check(label, false, error.message);
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
  }
}

await applyMigration("migration applies");
await applyMigration("migration is re-runnable");

await assign(STUDENT_A, MENTOR_A, "Mentor A");

const studentThreads = await listThreads(STUDENT_A);
const mentorThreads = await listThreads(MENTOR_A);
check("student sees the assigned mentor", studentThreads.length === 1 && studentThreads[0].participantName === "Mentor A", studentThreads);
check("mentor sees the assigned student", mentorThreads.length === 1 && mentorThreads[0].participantName === "Student A", mentorThreads);
check("both sides share one conversation", studentThreads[0]?.id === mentorThreads[0]?.id);
check("conversation exists with zero messages", studentThreads[0]?.lastMessageAt === null && studentThreads[0]?.unreadCount === 0, studentThreads[0]);
check("participant role is returned", studentThreads[0]?.participantRole === "mentor" && mentorThreads[0]?.participantRole === "student");

await assign(STUDENT_A, MENTOR_A, "Mentor A");
const repeated = await listThreads(STUDENT_A);
const { rows: threadCount } = await db.query("select count(*)::int as total from public.chat_threads");
check("repeat assignment reuses the conversation", repeated.length === 1 && repeated[0].id === studentThreads[0].id);
check("no duplicate conversation rows", threadCount[0].total === 1, threadCount[0]);

await db.query(
  "insert into public.messages (chat_thread_id, sender_id, receiver_id, body) values ($1, $2, $3, 'Hi mentor')",
  [studentThreads[0].id, STUDENT_A, MENTOR_A]
);
const mentorAfterMessage = await listThreads(MENTOR_A);
const studentAfterMessage = await listThreads(STUDENT_A);
check("mentor receives the message in the shared thread", mentorAfterMessage[0].lastMessagePreview === "Hi mentor", mentorAfterMessage[0]);
check("mentor unread count reflects the new message", mentorAfterMessage[0].unreadCount === 1, mentorAfterMessage[0]);
check("sender is not counted as unread", studentAfterMessage[0].unreadCount === 0, studentAfterMessage[0]);
check("latest timestamp is returned", Boolean(mentorAfterMessage[0].lastMessageAt));

await assign(STUDENT_A, MENTOR_B, "Mentor B");
const afterReassign = await listThreads(STUDENT_A);
const oldMentorThreads = await listThreads(MENTOR_A);
const newMentorThreads = await listThreads(MENTOR_B);
check("student sees the new mentor", afterReassign.length === 1 && afterReassign[0].participantName === "Mentor B", afterReassign);
check("new mentor sees the student", newMentorThreads.length === 1 && newMentorThreads[0].participantName === "Student A");
check("previous mentor loses conversation access", oldMentorThreads.length === 0, oldMentorThreads);

const unrelated = await listThreads(MENTOR_C);
check("unrelated mentor sees no conversations", unrelated.length === 0, unrelated);

await asUser(MENTOR_A);
const { rows: staleWrite } = await db.query("select public.is_chat_thread_participant($1) as allowed", [
  studentThreads[0].id
]);
await asUser(STUDENT_A);
const { rows: currentWrite } = await db.query("select public.is_chat_thread_participant($1) as allowed", [
  afterReassign[0].id
]);
check("previous mentor cannot post to the retired conversation", staleWrite[0].allowed === false, staleWrite[0]);
check("current pair can still post", currentWrite[0].allowed === true, currentWrite[0]);

await db.query("delete from public.chat_threads");
await db.query("update public.mentor_matches set status = 'accepted'");
const repaired = await listThreads(STUDENT_A);
check("existing assignment without a conversation is repaired", repaired.length === 1, repaired);
check("accepted assignments count as active", repaired[0]?.participantName === "Mentor B");

await db.close();
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
