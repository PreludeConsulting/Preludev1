import { z } from "zod";
import { readJsonBody, sendJson, getRequestUrl } from "./http.js";
import { getSupabaseAdmin, requireSupabaseUser } from "./lib/supabaseRequestAuth.js";
import { db } from "./authApi.js";
import {
  generatePromoCode,
  hashPromoCode,
  isValidPromoCodeFormat,
  normalizePromoCodeInput
} from "./lib/promoCodes.js";

const createSchema = z.object({
  publicCode: z.string().trim().min(4).max(64).optional(),
  description: z.string().trim().max(500).optional(),
  campaignName: z.string().trim().max(120).optional(),
  applicablePlan: z.enum(["basic", "plus", "pro"]).default("basic"),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  singleUse: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  accessDurationDays: z.number().int().positive().nullable().optional(),
  newUsersOnly: z.boolean().optional(),
  eligibleEmailDomains: z.array(z.string().trim().max(180)).optional(),
  eligibleEmails: z.array(z.string().email()).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
  count: z.number().int().min(1).max(100).optional()
});

const bulkSchema = z.object({
  prefix: z.string().trim().min(2).max(24).default("BASIC"),
  count: z.number().int().min(1).max(100).default(10),
  campaignName: z.string().trim().max(120).optional(),
  singleUse: z.boolean().default(true),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional()
});

async function requireAdmin(req) {
  const { user } = await requireSupabaseUser(req);
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const error = new Error("Admin promo management is not configured.");
    error.statusCode = 503;
    throw error;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    const error = new Error("Admin access required.");
    error.statusCode = 403;
    throw error;
  }

  return { user, supabase };
}

async function requirePrismaAdmin(req) {
  const { requireAuth } = await import("./authApi.js");
  const auth = await requireAuth(req);
  if (auth.user.role !== "ADMIN") {
    const error = new Error("Admin access required.");
    error.statusCode = 403;
    throw error;
  }
  return auth.user;
}

function adminPromoPath(pathname) {
  return pathname === "/api/admin/promo-codes" || pathname.startsWith("/api/admin/promo-codes/");
}

function mapPromoRow(row) {
  return {
    id: row.id,
    publicCode: row.public_code || row.publicCode,
    description: row.description,
    campaignName: row.campaign_name || row.campaignName,
    applicablePlan: row.applicable_plan || row.applicablePlan,
    maxRedemptions: row.max_redemptions ?? row.maxRedemptions ?? null,
    currentRedemptionCount: row.current_redemption_count ?? row.currentRedemptionCount ?? 0,
    singleUse: Boolean(row.single_use ?? row.singleUse),
    active: Boolean(row.active),
    expiresAt: row.expires_at || row.expiresAt || null,
    accessDurationDays: row.access_duration_days ?? row.accessDurationDays ?? null,
    newUsersOnly: Boolean(row.new_users_only ?? row.newUsersOnly),
    revokedAt: row.revoked_at || row.revokedAt || null,
    createdAt: row.created_at || row.createdAt,
    internalNotes: row.internal_notes || row.internalNotes || null
  };
}

async function listPromoCodes(supabase, searchParams) {
  let query = supabase.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(200);
  const search = searchParams.get("q")?.trim();
  const campaign = searchParams.get("campaign")?.trim();
  if (campaign) query = query.ilike("campaign_name", `%${campaign}%`);
  if (search) query = query.or(`public_code.ilike.%${search}%,campaign_name.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPromoRow);
}

async function listRedemptions(supabase, searchParams) {
  let query = supabase
    .from("promo_redemptions")
    .select("*, promo_codes(public_code, campaign_name)")
    .order("redeemed_at", { ascending: false })
    .limit(200);

  const email = searchParams.get("email")?.trim();
  const code = searchParams.get("code")?.trim();
  if (email) query = query.ilike("email", `%${email}%`);
  if (code) {
    const { data: promo } = await supabase.from("promo_codes").select("id").ilike("public_code", code).maybeSingle();
    if (promo?.id) query = query.eq("promo_code_id", promo.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function createPromoCodes(supabase, adminId, payload) {
  const count = payload.count || 1;
  const rows = [];

  for (let index = 0; index < count; index += 1) {
    const publicCode = normalizePromoCodeInput(payload.publicCode || generatePromoCode(payload.campaignName?.split(" ")[0] || "BASIC"));
    if (!isValidPromoCodeFormat(publicCode)) {
      const error = new Error("Generated promo code format is invalid.");
      error.statusCode = 400;
      throw error;
    }
    rows.push({
      public_code: publicCode,
      code_hash: hashPromoCode(publicCode),
      description: payload.description || null,
      campaign_name: payload.campaignName || null,
      applicable_plan: payload.applicablePlan || "basic",
      max_redemptions: payload.maxRedemptions ?? (payload.singleUse ? 1 : null),
      single_use: Boolean(payload.singleUse),
      expires_at: payload.expiresAt || null,
      access_duration_days: payload.accessDurationDays ?? null,
      new_users_only: payload.newUsersOnly ?? true,
      eligible_email_domains: payload.eligibleEmailDomains || [],
      eligible_emails: payload.eligibleEmails || [],
      internal_notes: payload.internalNotes || null,
      created_by: adminId,
      active: true
    });
  }

  const { data, error } = await supabase.from("promo_codes").insert(rows).select("*");
  if (error) throw error;
  return (data || []).map(mapPromoRow);
}

async function updatePromoCode(supabase, id, patch) {
  const allowed = {};
  if (patch.active !== undefined) allowed.active = patch.active;
  if (patch.revoked !== undefined) allowed.revoked_at = patch.revoked ? new Date().toISOString() : null;
  if (patch.internalNotes !== undefined) allowed.internal_notes = patch.internalNotes;
  if (patch.expiresAt !== undefined) allowed.expires_at = patch.expiresAt;
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from("promo_codes").update(allowed).eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  if (!data) {
    const notFound = new Error("Promo code not found.");
    notFound.statusCode = 404;
    throw notFound;
  }
  return mapPromoRow(data);
}

export function createAdminPromoApiMiddleware(env = process.env) {
  return async function adminPromoApiMiddleware(req, res, next) {
    const url = getRequestUrl(req);
    if (!adminPromoPath(url.pathname)) return next();

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.end();
      return;
    }

    try {
      let supabase = getSupabaseAdmin();
      let adminUser;
      if (supabase) {
        const auth = await requireAdmin(req);
        adminUser = auth.user;
        supabase = auth.supabase;
      } else {
        adminUser = await requirePrismaAdmin(req);
      }

      if (url.pathname === "/api/admin/promo-codes/redemptions" && req.method === "GET") {
        if (!supabase) return sendJson(res, 503, { error: "unavailable", message: "Redemption history requires Supabase." });
        const redemptions = await listRedemptions(supabase, url.searchParams);
        return sendJson(res, 200, { redemptions });
      }

      if (url.pathname === "/api/admin/promo-codes/attempts" && req.method === "GET") {
        if (!supabase) {
          const attempts = await db().promoValidationAttempt.findMany({
            orderBy: { createdAt: "desc" },
            take: 200
          });
          return sendJson(res, 200, { attempts });
        }
        const { data, error } = await supabase
          .from("promo_validation_attempts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return sendJson(res, 200, { attempts: data || [] });
      }

      if (url.pathname === "/api/admin/promo-codes/bulk" && req.method === "POST") {
        if (!supabase) return sendJson(res, 503, { error: "unavailable", message: "Bulk generation requires Supabase." });
        const payload = bulkSchema.parse(await readJsonBody(req));
        const created = await createPromoCodes(supabase, adminUser.id, {
          campaignName: payload.campaignName,
          singleUse: payload.singleUse,
          maxRedemptions: payload.maxRedemptions ?? (payload.singleUse ? 1 : null),
          expiresAt: payload.expiresAt,
          count: payload.count,
          publicCode: undefined
        });
        return sendJson(res, 201, { codes: created });
      }

      if (url.pathname === "/api/admin/promo-codes" && req.method === "GET") {
        if (!supabase) {
          const codes = await db().promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
          return sendJson(res, 200, { codes: codes.map(mapPromoRow) });
        }
        const codes = await listPromoCodes(supabase, url.searchParams);
        return sendJson(res, 200, { codes });
      }

      if (url.pathname === "/api/admin/promo-codes" && req.method === "POST") {
        const payload = createSchema.parse(await readJsonBody(req));
        if (supabase) {
          const created = await createPromoCodes(supabase, adminUser.id, payload);
          return sendJson(res, 201, { codes: created });
        }
        const publicCode = normalizePromoCodeInput(payload.publicCode || generatePromoCode());
        const created = await db().promoCode.create({
          data: {
            publicCode,
            codeHash: hashPromoCode(publicCode),
            description: payload.description,
            campaignName: payload.campaignName,
            applicablePlan: payload.applicablePlan,
            maxRedemptions: payload.maxRedemptions ?? (payload.singleUse ? 1 : null),
            singleUse: Boolean(payload.singleUse),
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            accessDurationDays: payload.accessDurationDays,
            newUsersOnly: payload.newUsersOnly ?? true,
            eligibleEmailDomains: payload.eligibleEmailDomains || [],
            eligibleEmails: payload.eligibleEmails || [],
            internalNotes: payload.internalNotes
          }
        });
        return sendJson(res, 201, { codes: [mapPromoRow(created)] });
      }

      const match = url.pathname.match(/^\/api\/admin\/promo-codes\/([^/]+)$/);
      if (match && req.method === "PATCH") {
        const body = await readJsonBody(req);
        if (supabase) {
          const updated = await updatePromoCode(supabase, match[1], body);
          return sendJson(res, 200, { code: updated });
        }
        const updated = await db().promoCode.update({
          where: { id: match[1] },
          data: {
            active: body.active,
            revokedAt: body.revoked ? new Date() : body.revoked === false ? null : undefined,
            internalNotes: body.internalNotes,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt === null ? null : undefined
          }
        });
        return sendJson(res, 200, { code: mapPromoRow(updated) });
      }

      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(res, 400, { error: "validation_error", issues: error.issues });
      }
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) console.error("[prelude-admin-promo]", error);
      return sendJson(res, statusCode, {
        error: error.code || (statusCode >= 500 ? "server_error" : "request_failed"),
        message: error.message || "Request failed."
      });
    }
  };
}

const middleware = createAdminPromoApiMiddleware();
export default function handler(req, res) {
  return middleware(req, res, () => sendJson(res, 404, { error: "not_found" }));
}
