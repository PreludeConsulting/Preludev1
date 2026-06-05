/**
 * Local dev database setup (non-interactive).
 * - Starts Docker Postgres
 * - Applies migrations (baselines if a prior migrate dev left tables without history)
 * - Seeds demo accounts
 */

import "../server/loadEnv.js";
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

function commandOutput(error) {
  return [error?.stdout, error?.stderr, error?.message].filter(Boolean).map((chunk) => String(chunk)).join("\n");
}

function run(command, options = {}) {
  execSync(command, { stdio: "inherit", env: process.env, ...options });
}

function runCapture(command) {
  return execSync(command, { encoding: "utf8", env: process.env }).trim();
}

function migrationNames() {
  return readdirSync(join(process.cwd(), "prisma/migrations"))
    .filter((name) => /^\d{14}_/.test(name))
    .sort();
}

function waitForPostgres(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      runCapture("docker compose exec -T db pg_isready -U prelude -d prelude_dev");
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error("PostgreSQL did not become ready. Is Docker running?");
      }
      execSync("sleep 1");
    }
  }
}

function baselineExistingSchema() {
  console.info("[db:setup] Baselining existing local schema (marking migrations as applied)…");
  for (const name of migrationNames()) {
    try {
      run(`npx prisma migrate resolve --applied "${name}"`);
    } catch (error) {
      const output = commandOutput(error);
      if (output.includes("already recorded") || output.includes("P3008")) continue;
      throw error;
    }
  }
}

function migrateDeploy() {
  try {
    const out = execSync("npx prisma migrate deploy", { encoding: "utf8", env: process.env });
    if (out) process.stdout.write(out);
  } catch (error) {
    error.message = commandOutput(error);
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing. Copy .env.example to .env first.");
    process.exit(1);
  }

  run("docker compose up -d");
  waitForPostgres();

  try {
    migrateDeploy();
  } catch (error) {
    const output = error.message || commandOutput(error);
    if (output.includes("P3005") || output.toLowerCase().includes("schema is not empty")) {
      baselineExistingSchema();
      migrateDeploy();
    } else {
      throw error;
    }
  }

  run("npm run seed:demo");
  console.info("\n[db:setup] Done. Demo logins: student@prelude-demo.com / Student123! · mentor@prelude-demo.com / Mentor123!\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
