import { resendVerificationEmail as prismaResend } from "./auth.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";

export async function resendVerificationEmail(user) {
  if (isSupabaseConfigured() && user?.authProvider === "supabase") {
    const { resendSignupConfirmation } = await import("./supabaseAuth.js");
    return resendSignupConfirmation(user.email);
  }
  return prismaResend();
}
