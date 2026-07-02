import { z } from "zod";
import { buildAuthUrl, deliverParentInviteEmail } from "./authEmail.js";
import { createSupabaseAdmin } from "./supabasePasswordReset.js";

export const parentInviteSendSchema = z.object({
  parentEmail: z.string().trim().email().max(255),
  studentName: z.string().trim().min(1).max(120).optional(),
  inviteToken: z.string().trim().min(8).max(200)
});

export function normalizeParentEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function getBearerToken(req) {
  return req?.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
}

function resolveRuntimeEnv(env) {
  if (env) return env;
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}

export async function requireSupabaseStudent(req, env) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const admin = createSupabaseAdmin(runtimeEnv);
  if (!admin) {
    const error = new Error("Supabase server credentials are not configured.");
    error.statusCode = 503;
    error.code = "parent_invites_unavailable";
    throw error;
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    const authError = new Error("Authentication required.");
    authError.statusCode = 401;
    throw authError;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    const dbError = new Error("Could not verify your student profile.");
    dbError.statusCode = 503;
    throw dbError;
  }

  if ((profile?.role || "").toLowerCase() !== "student") {
    const forbidden = new Error("Only student accounts can invite a parent or guardian.");
    forbidden.statusCode = 403;
    forbidden.code = "forbidden";
    throw forbidden;
  }

  return {
    admin,
    user: data.user,
    profile: profile || { role: "student", full_name: null, email: data.user.email }
  };
}

/**
 * Validate payload, verify the caller is a student, and deliver the parent invite email.
 */
export async function sendParentInviteEmail({ req, env, payload }) {
  const runtimeEnv = resolveRuntimeEnv(env);
  const parsed = parentInviteSendSchema.parse(payload);
  const { profile } = await requireSupabaseStudent(req, runtimeEnv);

  const parentEmail = normalizeParentEmail(parsed.parentEmail);
  const studentEmail = normalizeParentEmail(profile.email);
  if (studentEmail && parentEmail === studentEmail) {
    const error = new Error("Enter your parent or guardian's email, not your own.");
    error.statusCode = 400;
    error.code = "invalid_parent_email";
    throw error;
  }

  const url = buildAuthUrl(
    req,
    `/register?${new URLSearchParams({ parentInvite: parsed.inviteToken, role: "parent" }).toString()}`,
    runtimeEnv
  );

  const result = await deliverParentInviteEmail({
    to: parentEmail,
    studentName: profile.full_name || parsed.studentName || "your student",
    url,
    req,
    env: runtimeEnv
  });

  if (!result.delivered && !result.logged && runtimeEnv.NODE_ENV === "production") {
    const deliveryError = new Error(
      "We couldn't send the parent invitation email right now. Please try again in a moment."
    );
    deliveryError.statusCode = 503;
    deliveryError.code = "email_delivery_failed";
    throw deliveryError;
  }

  return {
    message: "Invitation email sent.",
    emailSent: Boolean(result.delivered || result.logged)
  };
}
