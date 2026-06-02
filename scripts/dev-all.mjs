#!/usr/bin/env node
/**
 * Run the standalone API server and Vite frontend together.
 * Vite proxies /api to the backend when PRELUDE_STANDALONE_API=1.
 */

import { execSync } from "node:child_process";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function freePort(port) {
  try {
    const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
    if (!pids) return;
    for (const pid of pids.split(/\s+/)) {
      if (pid) process.kill(Number(pid), "SIGKILL");
    }
  } catch {
    // port already free
  }
}

const apiPort = Number(process.env.PRELUDE_API_PORT ?? 3001);
freePort(apiPort);
const standaloneEntry = path.join(root, "server/standalone.js");

const server = spawn(process.execPath, [standaloneEntry], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env }
});

const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PRELUDE_STANDALONE_API: "1" }
});

function shutdown(code = 0) {
  server.kill("SIGTERM");
  vite.kill("SIGTERM");
  process.exit(code);
}

server.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});
vite.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Started Prelude API + Vite. Press Ctrl+C to stop.");
