import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAllDashboardKnowledgeRows,
  dashboardDataDir,
  upsertKnowledgeRows
} from "./lib/knowledgeIngest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function maybeSeedVerifiedKnowledge() {
  if (process.env.AI_INGEST_SKIP_VERIFIED === "1") return;
  const result = spawnSync("node", ["scripts/seed-prelude-ai-data.js"], {
    cwd: repoRoot,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error("Verified Prelude AI seed failed. Re-run with AI_INGEST_SKIP_VERIFIED=1 to ingest dashboard data only.");
  }
}

async function main() {
  console.log(`[ai:ingest] Reading dashboard knowledge from ${dashboardDataDir}`);
  const rows = await buildAllDashboardKnowledgeRows();
  await upsertKnowledgeRows(rows);
  console.log(`[ai:ingest] Upserted ${rows.length} dashboard knowledge rows.`);

  await maybeSeedVerifiedKnowledge();
  console.log("[ai:ingest] Done.");
}

main().catch((error) => {
  console.error("[ai:ingest]", error.message);
  process.exitCode = 1;
});
