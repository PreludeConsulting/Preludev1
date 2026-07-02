import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildAllDashboardKnowledgeRows,
  deleteDashboardKnowledge,
  upsertKnowledgeRows
} from "./lib/knowledgeIngest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main() {
  const deleted = await deleteDashboardKnowledge();
  console.log(`[ai:reset-knowledge] Deleted ${deleted} dashboard knowledge rows.`);

  const rows = await buildAllDashboardKnowledgeRows();
  await upsertKnowledgeRows(rows);
  console.log(`[ai:reset-knowledge] Re-ingested ${rows.length} dashboard knowledge rows.`);

  if (process.env.AI_RESET_SKIP_VERIFIED !== "1") {
    const result = spawnSync("node", ["scripts/seed-prelude-ai-data.js"], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error("Verified Prelude AI seed failed during reset.");
    }
  }

  console.log("[ai:reset-knowledge] Done.");
}

main().catch((error) => {
  console.error("[ai:reset-knowledge]", error.message);
  process.exitCode = 1;
});
