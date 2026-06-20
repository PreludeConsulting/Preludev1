/**
 * Parent invites and parent–student links (Supabase + local fallback).
 */

import { getSupabase } from "./supabase.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import { api } from "./auth.js";

const LOCAL_INVITES_PREFIX = "prelude_parent_invites_";
const PENDING_PARENT_INVITE_KEY = "prelude_pending_parent_invite";

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function readLocalInvites(studentId) {
  if (typeof window === "undefined" || !studentId) return [];
  try {
    const raw = window.localStorage.getItem(`${LOCAL_INVITES_PREFIX}${studentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalInvites(studentId, invites) {
  if (typeof window === "undefined" || !studentId) return;
  try {
    window.localStorage.setItem(`${LOCAL_INVITES_PREFIX}${studentId}`, JSON.stringify(invites));
  } catch {
    /* storage unavailable */
  }
}

function makeLocalToken() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listParentInvites(studentId) {
  if (!studentId) return [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (!supabase) return readLocalInvites(studentId);
    const { data, error } = await supabase
      .from("parent_invites")
      .select("*")
      .eq("student_id", studentId)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[prelude-parent] listParentInvites:", error.message);
      return readLocalInvites(studentId);
    }
    return data || [];
  }

  return readLocalInvites(studentId);
}

export async function studentHasParentInvites(studentId) {
  const invites = await listParentInvites(studentId);
  return invites.some((row) => row.status === "pending" || row.status === "accepted");
}

async function sendInviteEmail({ parentEmail, studentName, inviteToken }) {
  return api("/api/parent-invites/send", {
    method: "POST",
    body: JSON.stringify({ parentEmail, studentName, inviteToken })
  });
}

export async function inviteParent({ studentId, studentName, parentEmail }) {
  const email = normalizeEmail(parentEmail);
  if (!email || !studentId) throw new Error("Enter a valid parent email.");

  let inviteToken = makeLocalToken();
  let row = null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from("parent_invites")
        .upsert(
          {
            student_id: studentId,
            parent_email: email,
            status: "pending"
          },
          { onConflict: "student_id,parent_email" }
        )
        .select("*")
        .single();

      if (!error && data) {
        row = data;
        inviteToken = data.invite_token;
      } else if (error) {
        console.warn("[prelude-parent] inviteParent supabase:", error.message);
      }
    }
  }

  if (!row) {
    const existing = readLocalInvites(studentId);
    const next = existing.filter((item) => normalizeEmail(item.parent_email) !== email);
    row = {
      id: `local-${inviteToken}`,
      student_id: studentId,
      parent_email: email,
      status: "pending",
      invite_token: inviteToken,
      created_at: new Date().toISOString()
    };
    writeLocalInvites(studentId, [row, ...next]);
  }

  await sendInviteEmail({ parentEmail: email, studentName, inviteToken });
  return row;
}

export async function markParentInviteStepComplete(studentId) {
  if (!studentId) return;

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from("onboarding_progress")
        .upsert(
          { user_id: studentId, parent_invite_step_completed: true, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (!error) return;
      console.warn("[prelude-parent] markParentInviteStepComplete:", error.message);
    }
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`prelude_parent_invite_done_${studentId}`, "1");
    } catch {
      /* ignore */
    }
  }
}

export function readParentInviteStepComplete(studentId) {
  if (!studentId) return false;
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(`prelude_parent_invite_done_${studentId}`) === "1") return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export async function listLinkedChildren(parentId) {
  if (!parentId) return [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data: links, error } = await supabase
      .from("parent_student_links")
      .select("student_id, created_at")
      .eq("parent_id", parentId);
    if (error || !links?.length) return [];

    const ids = links.map((l) => l.student_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, grade_level").in("id", ids);
    const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

    return links.map((link) => {
      const profile = byId[link.student_id];
      return {
        id: link.student_id,
        name: profile?.full_name || "Student",
        grade: profile?.grade_level || null,
        linkedAt: link.created_at
      };
    });
  }

  return [];
}

export async function acceptParentInvite({ parentId, inviteToken }) {
  if (!parentId || !inviteToken) return { error: "Missing invite." };

  if (!isSupabaseConfigured()) {
    return { error: "Parent linking requires Supabase." };
  }

  const supabase = getSupabase();
  if (!supabase) return { error: "Supabase unavailable." };

  const { data: studentId, error } = await supabase.rpc("accept_parent_invite", {
    invite_token: inviteToken
  });

  if (error || !studentId) {
    return { error: error?.message || "This invitation is invalid or has already been used." };
  }

  return { studentId };
}

export function storePendingParentInvite(inviteToken) {
  if (!inviteToken || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_PARENT_INVITE_KEY, inviteToken);
  } catch {
    /* ignore */
  }
}

export function consumePendingParentInvite() {
  if (typeof window === "undefined") return null;
  try {
    const token = window.sessionStorage.getItem(PENDING_PARENT_INVITE_KEY);
    if (token) window.sessionStorage.removeItem(PENDING_PARENT_INVITE_KEY);
    return token || null;
  } catch {
    return null;
  }
}

export async function acceptPendingParentInvite(parentId) {
  const inviteToken = consumePendingParentInvite();
  if (!inviteToken || !parentId) return null;
  return acceptParentInvite({ parentId, inviteToken });
}

export function parentInviteRegisterPath(inviteToken) {
  const params = new URLSearchParams({ parentInvite: inviteToken, role: "parent" });
  return `/register?${params.toString()}`;
}
