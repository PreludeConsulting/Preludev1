#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dockerCompose, projectRoot } from "./db-utils.mjs";

const root = projectRoot();
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

console.log("Resetting local Prelude database volume…");
dockerCompose("down -v");
console.log("Re-running database setup…");
const result = spawnSync(process.execPath, [path.join(scriptsDir, "db-setup.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: process.env
});
process.exit(result.status ?? 0);
