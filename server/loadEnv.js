import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(repoRoot, ".env");

const PLACEHOLDER_KEYS = new Set([
  "",
  "sk-your-key-here",
  "sk-your-openai-key",
  "your-openai-api-key",
  "changeme"
]);

export function isOpenAiKeyConfigured(value = process.env.OPENAI_API_KEY) {
  const key = String(value ?? "").trim();
  return Boolean(key) && !PLACEHOLDER_KEYS.has(key);
}

if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.warn("[prelude-server] Failed to load .env:", result.error.message);
  }
}

export { envPath, repoRoot };
