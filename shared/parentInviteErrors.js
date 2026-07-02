/**
 * Map Supabase / API parent-invite failures to user-facing copy.
 */
export function friendlyParentInviteError(error, fallback = "Could not send the invitation.") {
  if (!error) return fallback;

  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.payload?.error || error?.code || "").toLowerCase();

  if (code === "email_delivery_failed") {
    return "We couldn't send the parent invitation email right now. Please try again in a moment.";
  }
  if (code === "parent_invites_unavailable") {
    return "Parent invitations are not configured on the server yet. Contact Prelude support.";
  }
  if (code === "forbidden") {
    return "Only student accounts can invite a parent or guardian.";
  }
  if (code === "invalid_parent_email") {
    return "Enter your parent or guardian's email, not your own.";
  }
  if (code === "validation_error") {
    return "Enter a valid parent or guardian email address.";
  }
  if (message.includes("authentication required") || code === "unauthenticated") {
    return "Your session expired. Sign in again and retry the invitation.";
  }
  if (message.includes("you can only connect a parent email to your own account")) {
    return "Sign in as the student account before inviting a parent.";
  }
  if (message.includes("enter a valid parent email")) {
    return "Enter a valid parent or guardian email address.";
  }
  if (
    message.includes("parent_invites") &&
    (message.includes("does not exist") || message.includes("schema cache") || message.includes("relation"))
  ) {
    return "Parent invitations are not enabled in Supabase yet. Run supabase/migrations/20260703000000_parent_links.sql.";
  }
  if (message.includes("connect_student_parent_email") && message.includes("function")) {
    return "Parent linking is not enabled in Supabase yet. Run supabase/migrations/20260703000000_parent_links.sql.";
  }
  if (message.includes("rate limit") || code === "rate_limit_exceeded") {
    return "Too many invitation attempts. Please wait a moment and try again.";
  }

  return error?.message || fallback;
}
