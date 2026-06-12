#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { baselineMigrationsIfNeeded, databaseUrl, dockerCompose, projectRoot, run, waitForPostgres } from "./db-utils.mjs";

const root = projectRoot();
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

console.log("Setting up local Prelude database…");
dockerCompose("up -d");
process.env.DATABASE_URL = databaseUrl();
waitForPostgres();

console.log("Generating Prisma client…");
run("npx prisma generate");

console.log("Applying migrations…");
baselineMigrationsIfNeeded();

console.log("Seeding demo accounts…");
const seed = spawnSync(process.execPath, [path.join(scriptsDir, "seed-demo.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});
if ((seed.status ?? 1) !== 0) process.exit(seed.status ?? 1);

console.log("\nLocal database is ready.");
console.log("Demo logins:");
console.log("  Student: student@prelude-demo.com / Student123!");
console.log("  Mentor:  mentor@prelude-demo.com / Mentor123!");
console.log("\nNext: npm run dev  →  http://localhost:5173/register");
