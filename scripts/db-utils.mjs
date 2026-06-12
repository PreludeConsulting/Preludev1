#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_DATABASE_URL =
  "postgresql://prelude:prelude_dev_password@localhost:5432/prelude_dev?schema=public";

export function projectRoot() {
  return root;
}

export function loadDotEnv() {
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function databaseUrl() {
  loadDotEnv();
  return process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
}

export function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl(), ...options.env }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function capture(command, options = {}) {
  try {
    return execSync(command, {
      cwd: root,
      shell: true,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databaseUrl(), ...options.env },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stdout = error.stdout?.toString?.() || "";
    const stderr = error.stderr?.toString?.() || "";
    const err = new Error(stderr || stdout || error.message);
    err.stdout = stdout;
    err.stderr = stderr;
    throw err;
  }
}

export function dockerCompose(args) {
  try {
    capture("docker compose version");
  } catch {
    console.error("Docker Compose is not available. Install Docker Desktop and ensure it is running.");
    process.exit(1);
  }

  const result = spawnSync(`docker compose -f compose.yml ${args}`, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: process.env
  });

  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.stderr?.trim()) console.error(result.stderr.trim());

  if (result.status !== 0) {
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if (/dockerDesktopLinuxEngine|docker daemon|Cannot connect to the Docker daemon/i.test(output)) {
      console.error("\nDocker is installed but the daemon is not running.");
      console.error("Start Docker Desktop, then run: npm run db:setup");
    }
    process.exit(result.status ?? 1);
  }
}

function sleep(ms) {
  execSync(`node -e "setTimeout(() => {}, ${ms})"`, { stdio: "ignore", shell: true });
}

export function waitForPostgres(maxAttempts = 40) {
  const url = databaseUrl();
  process.env.DATABASE_URL = url;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      capture("npx prisma migrate status");
      return;
    } catch (error) {
      const output = `${error.stdout || ""}${error.stderr || ""}${error.message}`;
      const retryable = /Can't reach database server|ECONNREFUSED|P1001|Connection refused/i.test(output);
      if (!retryable || attempt === maxAttempts) {
        console.error("\nPostgreSQL is not reachable at localhost:5432.");
        console.error("Start it with: npm run db:start");
        process.exit(1);
      }
      sleep(1500);
    }
  }
}

export function baselineMigrationsIfNeeded() {
  process.env.DATABASE_URL = databaseUrl();
  try {
    capture("npx prisma migrate deploy");
    return;
  } catch (error) {
    const output = `${error.stdout || ""}${error.stderr || ""}`;
    if (!/P3005|schema is not empty/i.test(output)) {
      console.error(output.trim() || error.message);
      process.exit(1);
    }
    console.log("Database schema is not empty — baselining existing migrations…");
    const migrationsDir = path.join(root, "prisma", "migrations");
    const folders = capture(
      `node -e "const fs=require('fs');const p=${JSON.stringify(migrationsDir)};console.log(fs.readdirSync(p).filter(f=>fs.statSync(require('path').join(p,f)).isDirectory()).sort().join('\\n'))"`
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    for (const folder of folders) {
      run(`npx prisma migrate resolve --applied ${folder}`);
    }
    run("npx prisma migrate deploy");
  }
}
