import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "prelude_ai_data");

const REQUIRED_FILES = [
  "sources.json",
  "college_scorecard_schema.md",
  "ipeds_schema.md",
  "common_app_essay_prompts.md",
  "fafsa_financial_aid.md",
  "career_data_schema.md",
  "admissions_rules.md",
  "sample_rag_documents.jsonl"
];

const DEFAULT_LAST_VERIFIED = new Date().toISOString();
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;

function ensureRequiredFilesExist() {
  for (const fileName of REQUIRED_FILES) {
    const filePath = path.join(dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing required data file: ${filePath}`);
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonLines(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function chunkText(rawText, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const text = String(rawText ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(Boolean);
}

function stableChunkId(sourceId, title, chunkIndex, content) {
  const hash = crypto
    .createHash("sha256")
    .update(`${sourceId}|${title}|${chunkIndex}|${content}`)
    .digest("hex")
    .slice(0, 20);
  return `ak_${sourceId}_${chunkIndex}_${hash}`;
}

function inferCategoryFromFileName(fileName) {
  if (fileName.includes("career")) return "careers";
  if (fileName.includes("fafsa")) return "financial_aid";
  if (fileName.includes("essay")) return "essays";
  if (fileName.includes("ipeds")) return "college_data";
  if (fileName.includes("scorecard")) return "college_data";
  if (fileName.includes("admissions")) return "admissions_policy";
  return "general";
}

function buildSourceLookup(sources) {
  const map = new Map();
  for (const source of sources) {
    map.set(source.source_id, source);
  }
  return map;
}

function resolveSourceForCategory(category, sourceMap) {
  if (category === "financial_aid") return sourceMap.get("federal_student_aid");
  if (category === "careers") return sourceMap.get("onet");
  if (category === "essays") return sourceMap.get("common_app");
  if (category === "college_data") return sourceMap.get("college_scorecard");
  return sourceMap.get("college_scorecard");
}

function toDate(value) {
  const parsed = value ? new Date(value) : new Date(DEFAULT_LAST_VERIFIED);
  return Number.isNaN(parsed.valueOf()) ? new Date(DEFAULT_LAST_VERIFIED) : parsed;
}

function buildSeedDocuments() {
  const sources = readJson(path.join(dataDir, "sources.json"));
  const sourceMap = buildSourceLookup(sources);
  const docs = [];

  const jsonlDocs = readJsonLines(path.join(dataDir, "sample_rag_documents.jsonl"));
  for (const doc of jsonlDocs) {
    const source =
      sources.find((s) => doc.source_url && s.url === doc.source_url) ??
      resolveSourceForCategory(doc.category, sourceMap);

    docs.push({
      sourceId: source?.source_id ?? "manual",
      sourceName: doc.source ?? source?.name ?? "Manual Source",
      sourceUrl: doc.source_url ?? source?.url ?? "",
      category: doc.category ?? "general",
      title: doc.title ?? "Knowledge Document",
      text: doc.text ?? "",
      lastVerified: DEFAULT_LAST_VERIFIED
    });
  }

  const markdownFileMap = [
    { file: "college_scorecard_schema.md", sourceId: "college_scorecard", title: "College Scorecard schema and usage" },
    { file: "ipeds_schema.md", sourceId: "ipeds", title: "IPEDS schema and usage" },
    { file: "common_app_essay_prompts.md", sourceId: "common_app", title: "Common App prompt policy and categories" },
    { file: "fafsa_financial_aid.md", sourceId: "federal_student_aid", title: "FAFSA and federal aid guidance" },
    { file: "career_data_schema.md", sourceId: "bls_ooh", title: "Career data schema and usage policy" },
    { file: "admissions_rules.md", sourceId: "college_scorecard", title: "Admissions verified-data policy" }
  ];

  for (const entry of markdownFileMap) {
    const source = sourceMap.get(entry.sourceId);
    const fullPath = path.join(dataDir, entry.file);
    const text = fs.readFileSync(fullPath, "utf8");
    docs.push({
      sourceId: entry.sourceId,
      sourceName: source?.name ?? entry.sourceId,
      sourceUrl: source?.url ?? "",
      category: inferCategoryFromFileName(entry.file),
      title: entry.title,
      text,
      lastVerified: DEFAULT_LAST_VERIFIED
    });
  }

  return docs;
}

function toChunkRows(doc) {
  const chunks = chunkText(doc.text);
  return chunks.map((content, index) => ({
    id: stableChunkId(doc.sourceId, doc.title, index, content),
    sourceId: doc.sourceId,
    sourceName: doc.sourceName,
    sourceUrl: doc.sourceUrl,
    category: doc.category,
    title: doc.title,
    content,
    lastVerified: toDate(doc.lastVerified)
  }));
}

async function seedToDatabase(rows) {
  const prisma = new PrismaClient();
  try {
    if (!prisma.aiKnowledgeChunk) {
      throw new Error("Prisma model aiKnowledgeChunk is unavailable. Run prisma generate/migrate first.");
    }

    for (const row of rows) {
      await prisma.aiKnowledgeChunk.upsert({
        where: { id: row.id },
        update: {
          sourceId: row.sourceId,
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl,
          category: row.category,
          title: row.title,
          content: row.content,
          sourceFile: row.sourceFile ?? null,
          sourceType: row.sourceType ?? null,
          metadata: row.metadata ?? {},
          searchableText: row.searchableText ?? null,
          lastVerified: row.lastVerified
        },
        create: {
          ...row,
          sourceFile: row.sourceFile ?? null,
          sourceType: row.sourceType ?? null,
          metadata: row.metadata ?? {},
          searchableText: row.searchableText ?? null
        }
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  ensureRequiredFilesExist();
  const docs = buildSeedDocuments();
  const rows = docs.flatMap(toChunkRows);

  if (!rows.length) {
    console.log("No rows generated.");
    return;
  }

  await seedToDatabase(rows);
  console.log(`Seeded ${rows.length} AiKnowledgeChunk rows.`);
}

main().catch((error) => {
  console.error("[seed-prelude-ai-data]", error.message);
  process.exitCode = 1;
});
