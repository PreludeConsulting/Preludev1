import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { config as cfConfig } from "../functions/_lib/http.js";
import { isLegacyPrismaAuthEnabled } from "../server/lib/legacyPrismaAuth.js";
import { hasMatchingTeamAccess } from "../shared/matchingTeamAccess.js";
import { mapSupabaseUser } from "../src/lib/supabaseSession.js";
import { isDevAuthBypassEnabled } from "../src/lib/devAuthBypass.js";

const root = process.cwd();
const auditMigration = "supabase/migrations/20260806000000_audit_security_hardening.sql";
const read = (file) => {
  const absolutePath = path.join(root, file);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
};

describe("audit security hardening migration", () => {
  const sql = read(auditMigration);

  it("exists and locks mentor_matches client writes", () => {
    expect(sql.length).toBeGreaterThan(100);
    expect(sql).toMatch(/revoke insert,\s*update,\s*delete on table public\.mentor_matches from authenticated,\s*anon/i);
    expect(sql).toMatch(/Mentor matches viewable by participants/i);
    expect(sql).toMatch(/check \(status in \('saved',\s*'pending',\s*'assigned',\s*'accepted',\s*'active'\)\)/i);
    expect(sql).toMatch(/drop policy if exists "Mentor matches insertable by student"/i);
    expect(sql).toMatch(/drop policy if exists "Mentor matches updatable by participants"/i);
    expect(sql).toMatch(/drop policy if exists "Mentor matches deletable by student"/i);
    expect(sql).not.toMatch(/create policy "Mentor matches insertable by student"/i);
  });

  it("narrows onboarding_progress grants and adds entitlement guard", () => {
    expect(sql).toMatch(/function public\.enforce_onboarding_entitlement_guard\(\)/i);
    expect(sql).toMatch(/onboarding_entitlement_guard/i);
    expect(sql).toMatch(/grant update \(\s*user_id,\s*questionnaire_answers,\s*mentor_matching_started,\s*profile_complete,\s*pending_checkout_plan_id,\s*updated_at\s*\)/i);
    expect(sql).not.toMatch(/grant update \([\s\S]*prelude_match_completed[\s\S]*\) on table public\.onboarding_progress to authenticated/i);
    expect(sql).not.toMatch(/grant update \([\s\S]*mentor_matching_complete[\s\S]*\) on table public\.onboarding_progress to authenticated/i);
    expect(sql).not.toMatch(/grant update \([\s\S]*parent_invite_step_completed[\s\S]*\) on table public\.onboarding_progress to authenticated/i);
  });

  it("drops reward wallet/task owner FOR ALL and adds claim RPCs", () => {
    expect(sql).toMatch(/drop policy if exists "reward_wallets_owner_upsert"/i);
    expect(sql).toMatch(/drop policy if exists "reward_task_instances_owner_mutate"/i);
    expect(sql).toMatch(/function public\.claim_reward_task\(/i);
    expect(sql).toMatch(/function public\.ensure_reward_task_instances\(/i);
    expect(sql).toMatch(/function public\.sync_dashboard_reward_task_progress\(/i);
    expect(sql).toMatch(/function public\.complete_mentor_reward_task\(/i);
    expect(sql).toMatch(/claim_reward_task[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/for update/i);
  });

  it("blocks parent self-assignment and fixes change_onboarding_role search_path", () => {
    expect(sql).toMatch(/Parent accounts join through an invitation only/i);
    expect(sql).toMatch(/new\.role = 'parent'/i);
    expect(sql).toMatch(/create or replace function public\.change_onboarding_role\(requested_role text\)[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/before insert or update on public\.profiles/i);
  });

  it("keeps prelude_match_submissions RLS model and adds updated_at touch", () => {
    const submissions = read("supabase/migrations/20260804000000_prelude_match_submissions.sql");
    expect(submissions).toMatch(/for select/i);
    expect(submissions).toMatch(/revoke insert, update, delete/i);
    expect(sql).toMatch(/touch_prelude_match_submissions_updated_at/i);
  });
});

describe("CF config fail-closed", () => {
  it("never falls back to service role as anon key", () => {
    const cfg = cfConfig({
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-secret"
      }
    });
    expect(cfg.key).toBe("");
    expect(cfg.serviceRoleKey).toBe("service-secret");
  });

  it("uses anon or publishable key when present", () => {
    expect(
      cfConfig({
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "anon-key"
        }
      }).key
    ).toBe("anon-key");
    expect(
      cfConfig({
        env: {
          SUPABASE_URL: "https://example.supabase.co",
          VITE_SUPABASE_PUBLISHABLE_KEY: "pub-key"
        }
      }).key
    ).toBe("pub-key");
  });
});

describe("legacy Prisma auth gate", () => {
  it("is disabled in production without AUTH_LEGACY_PRISMA", () => {
    expect(isLegacyPrismaAuthEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("is enabled with AUTH_LEGACY_PRISMA=1 or non-production", () => {
    expect(isLegacyPrismaAuthEnabled({ NODE_ENV: "production", AUTH_LEGACY_PRISMA: "1" })).toBe(true);
    expect(isLegacyPrismaAuthEnabled({ NODE_ENV: "development" })).toBe(true);
  });
});

describe("matching team access", () => {
  it("ignores client-writable matching_team_access booleans", () => {
    expect(hasMatchingTeamAccess({ matching_team_access: true, role: "student" })).toBe(false);
    expect(hasMatchingTeamAccess({ is_matching_team: true, role: "mentor" })).toBe(false);
    expect(hasMatchingTeamAccess({ role: "admin" })).toBe(true);
    expect(hasMatchingTeamAccess({ systemRole: "admin", role: "student" })).toBe(true);
  });
});

describe("session entitlement trust", () => {
  const originalLocalStorage = globalThis.localStorage;
  let store;

  beforeEach(() => {
    store = {};
    globalThis.localStorage = {
      getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
      setItem: (key, value) => {
        store[key] = String(value);
      },
      removeItem: (key) => {
        delete store[key];
      }
    };
    globalThis.window = { localStorage: globalThis.localStorage };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
    delete globalThis.window;
  });

  it("does not unlock payment or plan from localStorage alone", () => {
    const userId = "user-1";
    store[`prelude_plan_${userId}`] = "pro";
    store[`prelude_payment_done_${userId}`] = "1";
    store[`prelude_parent_invite_done_${userId}`] = "1";

    const mapped = mapSupabaseUser(
      { user: { id: userId, email: "a@b.com", email_confirmed_at: "2026-01-01", identities: [] } },
      { role: "student", plan_id: null, payment_waived: false, role_selection_complete: true },
      {
        payment_step_completed: false,
        parent_invite_step_completed: false,
        onboarding_status: "needs_plan",
        prelude_match_completed: false
      }
    );

    expect(mapped.plan).toBeFalsy();
    expect(mapped.paymentStepComplete).toBe(false);
    expect(mapped.parentInviteStepComplete).toBe(false);
    expect(mapped.planSelected).toBe(false);
  });

  it("honors DB payment and plan fields", () => {
    const mapped = mapSupabaseUser(
      { user: { id: "user-2", email: "a@b.com", email_confirmed_at: "2026-01-01", identities: [] } },
      { role: "student", plan_id: "plus", payment_waived: false, role_selection_complete: true },
      {
        payment_step_completed: true,
        parent_invite_step_completed: true,
        onboarding_status: "onboarding_completed",
        prelude_match_completed: true
      }
    );
    expect(mapped.plan).toBe("plus");
    expect(mapped.paymentStepComplete).toBe(true);
    expect(mapped.parentInviteStepComplete).toBe(true);
    expect(mapped.planSelected).toBe(true);
  });
});

describe("client write path removals", () => {
  it("mentorSelectionApi has no direct-DB catch fallback", () => {
    const src = read("src/lib/mentorSelectionApi.js");
    expect(src).not.toMatch(/saveMentorSelectionDirect/);
    expect(src).not.toMatch(/loadMentorSelectionStateDirect/);
  });

  it("preludeMatchService does not write mentor_matches", () => {
    const src = read("src/lib/preludeMatchService.js");
    expect(src).not.toMatch(/\.from\(\s*["']mentor_matches["']\s*\)\s*\.\s*(insert|update|upsert|delete)/);
  });

  it("dashboardData claims rewards via RPC", () => {
    const src = read("src/lib/dashboardData.js");
    expect(src).toMatch(/rpc\(\s*["']claim_reward_task["']/);
    expect(src).toMatch(/rpc\(\s*["']ensure_reward_task_instances["']/);
    expect(src).toMatch(/rpc\(\s*["']sync_dashboard_reward_task_progress["']/);
    expect(src).toMatch(/rpc\(\s*["']complete_mentor_reward_task["']/);
    expect(src).not.toMatch(/\.from\(\s*["']reward_wallets["']\s*\)\s*\.\s*upsert/);
  });

  it("edge send-prelude-match is retired", () => {
    const src = read("supabase/functions/send-prelude-match/index.ts");
    expect(src).toMatch(/status:\s*410/);
    expect(src).toMatch(/\/api\/prelude-match\/submit/);
  });

  it("CF mentor-selection route exists", () => {
    expect(fs.existsSync(path.join(root, "functions/api/onboarding/mentor-selection.js"))).toBe(true);
    expect(fs.existsSync(path.join(root, "functions/_lib/mentorSelection.js"))).toBe(true);
  });
});

describe("dev auth bypass", () => {
  it("is not enabled when PROD is true", () => {
    // Function reads import.meta.env; in vitest DEV may be true.
    // Contract: source requires both DEV and VITE_DEV_BYPASS_AUTH=1.
    const src = read("src/lib/devAuthBypass.js");
    expect(src).toMatch(/import\.meta\.env\.DEV && import\.meta\.env\.VITE_DEV_BYPASS_AUTH === ["']1["']/);
    expect(typeof isDevAuthBypassEnabled()).toBe("boolean");
  });
});

describe("service role absent from client bundles sources", () => {
  it("does not reference SUPABASE_SERVICE_ROLE_KEY in src/", () => {
    const walk = (dir) => {
      const out = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
      }
      return out;
    };
    const hits = [];
    for (const file of walk(path.join(root, "src"))) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) hits.push(path.relative(root, file));
    }
    expect(hits).toEqual([]);
  });
});

describe("react-router v8 browser APIs", () => {
  it("exports BrowserRouter, Link, and useSearchParams from react-router", async () => {
    const pkg = JSON.parse(read("node_modules/react-router/package.json") || "{}");
    expect(pkg.version).toMatch(/^8\./);
    const mod = await import("react-router");
    expect(mod.BrowserRouter).toBeTruthy();
    expect(mod.Link).toBeTruthy();
    expect(typeof mod.useSearchParams).toBe("function");
    expect(fs.existsSync(path.join(root, "node_modules/react-router-dom/package.json"))).toBe(false);
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.dependencies?.["react-router-dom"]).toBeUndefined();
  });
});

describe("onboarding insert defaults migration", () => {
  const sql = read("supabase/migrations/20260807000000_onboarding_insert_defaults.sql");

  it("forces needs_plan on INSERT and does not re-grant onboarding_status", () => {
    expect(sql.length).toBeGreaterThan(100);
    expect(sql).toMatch(/alter column onboarding_status set default 'needs_plan'/i);
    expect(sql).toMatch(/tg_op = 'INSERT'[\s\S]*new\.onboarding_status := 'needs_plan'/i);
    expect(sql).not.toMatch(/grant (insert|update)[\s\S]*onboarding_status/i);
    expect(sql).not.toMatch(/grant update \([\s\S]*onboarding_status[\s\S]*\) on table public\.onboarding_progress/i);
  });

  it("ensureDependentRecords does not write onboarding_status", () => {
    const src = read("src/lib/supabaseAuth.js");
    expect(src).toMatch(/from\("onboarding_progress"\)\.insert\(\{\s*user_id:\s*userId,\s*updated_at:/);
    expect(src).not.toMatch(/onboarding_progress"\)\.insert\(\{[^}]*onboarding_status/);
  });
});

describe("student daily activity lock migration", () => {
  const sql = read("supabase/migrations/20260807010000_lock_student_daily_activity.sql");

  it("drops owner FOR ALL and adds empty-search_path RPCs", () => {
    expect(sql).toMatch(/drop policy if exists "student_daily_activity_owner_mutate"/i);
    expect(sql).toMatch(/revoke insert,\s*update,\s*delete on table public\.student_daily_activity from authenticated,\s*anon/i);
    expect(sql).toMatch(/function public\.record_student_login_activity\(\)[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/function public\.record_student_network_message_activity\(\)[\s\S]*set search_path = ''/i);
    expect(sql).toMatch(/auth\.uid\(\)/);
  });

  it("client uses RPCs instead of direct activity upserts", () => {
    const src = read("src/lib/dashboardData.js");
    expect(src).toMatch(/rpc\(\s*["']record_student_login_activity["']/);
    expect(src).toMatch(/rpc\(\s*["']record_student_network_message_activity["']/);
    expect(src).not.toMatch(/\.from\(\s*["']student_daily_activity["']\s*\)\s*\.\s*upsert/);
  });
});
