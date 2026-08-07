import { createAuthApiMiddleware, requireAuth } from "./authApi.js";
import { createBillingApiMiddleware } from "./billingApi.js";
import { createChatApiMiddleware } from "./chatApi.js";
import { createDatasetsApiMiddleware } from "./datasetsApi.js";
import { createDashboardApiMiddleware } from "./dashboardApi.js";
import { createSupabaseDashboardApiMiddleware } from "./supabaseDashboardApi.js";
import { createSupabaseLoginVerificationMiddleware } from "./supabaseLoginVerificationApi.js";
import { createSupabaseParentInvitesMiddleware } from "./supabaseParentInvitesApi.js";
import { createSupabasePasswordResetMiddleware } from "./supabasePasswordResetApi.js";
import { createSupabaseSignupVerificationMiddleware } from "./supabaseSignupVerificationApi.js";
import { createOnboardingMentorSelectionMiddleware } from "./onboardingMentorSelectionApi.js";
import { createPromoApiMiddleware } from "./promoApi.js";
import { createAdminPromoApiMiddleware } from "./adminPromoApi.js";
import { createReferralApiMiddleware } from "./referralApi.js";
import { createReferralRotationApiMiddleware } from "./referralRotationApi.js";
import { createBugReportsMiddleware } from "./bugReportsApi.js";
import { createContactBookingsMiddleware } from "./contactBookingsApi.js";
import { createPreludeMatchSubmitMiddleware } from "./preludeMatchSubmitApi.js";
import { createMentorActivitiesApiMiddleware } from "./mentorActivitiesApi.js";
import { createApiRateLimitMiddleware } from "./lib/apiRateLimitMiddleware.js";
import { isLegacyPrismaAuthEnabled } from "./lib/legacyPrismaAuth.js";

/** Shared Prelude API middleware stack (Supabase dashboard → legacy auth/dashboard → billing → datasets → chat). */
export function createPreludeApiStack(env = process.env) {
  const legacyPrisma = isLegacyPrismaAuthEnabled(env);
  const stack = [
    createApiRateLimitMiddleware({ env }),
    // Supabase dashboard routes must run before the legacy Prisma dashboard/auth
    // middleware, which cannot validate Supabase bearer tokens.
    createSupabaseDashboardApiMiddleware(),
    createMentorActivitiesApiMiddleware({ env }),
    createBugReportsMiddleware(env),
    createContactBookingsMiddleware(env),
    createPreludeMatchSubmitMiddleware(env)
  ];

  if (legacyPrisma) {
    // Keep legacy cookie-authenticated dashboard routes ahead of the broad
    // auth middleware, which otherwise turns unknown dashboard paths into 404s.
    stack.push(
      createDashboardApiMiddleware(async (req) => {
        try {
          const auth = await requireAuth(req);
          return auth;
        } catch {
          return null;
        }
      })
    );
  }

  stack.push(
    createSupabaseLoginVerificationMiddleware(),
    createSupabaseParentInvitesMiddleware(env),
    createSupabasePasswordResetMiddleware(env),
    createSupabaseSignupVerificationMiddleware(env),
    createOnboardingMentorSelectionMiddleware(env),
    createPromoApiMiddleware(env),
    createAdminPromoApiMiddleware(env),
    createReferralApiMiddleware(env),
    createReferralRotationApiMiddleware(env)
  );

  if (legacyPrisma) {
    stack.push(createAuthApiMiddleware(env));
  }

  stack.push(createBillingApiMiddleware(), createDatasetsApiMiddleware(), createChatApiMiddleware(env));
  return stack;
}
