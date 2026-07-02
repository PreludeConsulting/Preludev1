import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { classifyUniversityFit, buildDashboardKnowledgeRows } from "../../scripts/lib/knowledgeIngest.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const SAMPLE_DOCS_PATH = path.join(repoRoot, "prelude_ai_data", "sample_rag_documents.jsonl");
const DASHBOARD_DATA_DIR = path.join(repoRoot, "prelude_ai_data", "dashboard");

const DASHBOARD_SOURCE_TYPES = new Set([
  "university",
  "scholarship",
  "summer_program",
  "extracurricular",
  "cs_project",
  "sat_report",
  "act_report"
]);

let prismaSingleton = null;
let sampleDocCache = null;
let dashboardCsvCache = null;

function getPrisma() {
  if (!prismaSingleton) prismaSingleton = new PrismaClient();
  return prismaSingleton;
}

function parseJsonLines(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => JSON.parse(line));
}

function loadSampleDocs() {
  if (sampleDocCache) return sampleDocCache;
  try {
    sampleDocCache = parseJsonLines(SAMPLE_DOCS_PATH);
  } catch {
    sampleDocCache = [];
  }
  return sampleDocCache;
}

function extractTerms(message) {
  return [...new Set(
    String(message ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9* ]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 3)
      .slice(0, 16)
  )];
}

function sourceTypeHintsForMessage(message) {
  const text = String(message ?? "").toLowerCase();
  const hints = [];

  if (/\b(college|university|school list|reach|target|safety|tuition|admission rate|compare schools?)\b/.test(text)) {
    hints.push("university");
  }
  if (/\b(scholarships?|award amount|deadline month|merit aid)\b/.test(text)) {
    hints.push("scholarship");
  }
  if (/\b(summer program|rsi|yygs|mites|pre-college)\b/.test(text)) {
    hints.push("summer_program");
  }
  if (/\b(extracurricular|activity profile|leadership role|club|volunteer)\b/.test(text)) {
    hints.push("extracurricular");
  }
  if (/\b(cs project|computer science project|coding project|portfolio|github)\b/.test(text)) {
    hints.push("cs_project");
  }
  if (/\b(sat|psat|college board|digital sat)\b/.test(text)) {
    hints.push("sat_report");
  }
  if (/\b(act\b|american college testing)\b/.test(text)) {
    hints.push("act_report");
  }

  return [...new Set(hints)];
}

function categoryHintsForMessage(message) {
  const text = String(message ?? "").toLowerCase();
  const hints = [...sourceTypeHintsForMessage(message)];

  if (/\b(fafsa|financial aid|grant|loan|work-study|aid)\b/.test(text)) hints.push("financial_aid");
  if (/\b(common app|essay|personal statement|prompt|supplement)\b/.test(text)) hints.push("essays");
  if (/\b(career|salary|job outlook|occupation|major-to-career|skills)\b/.test(text)) hints.push("careers");
  if (/\b(compare|acceptance|sat|act|tuition|cost|graduation|retention|debt|earnings|college)\b/.test(text)) {
    hints.push("college_data", "university");
  }
  if (/\b(stanford|summer program|submit my sat)\b/.test(text)) {
    hints.push("admissions_policy", "admissions_strategy");
  }
  if (/\bget into\b/.test(text) && !/\b(harvard|stanford|yale|mit|princeton|columbia|brown|duke|college|university)\b/i.test(text)) {
    hints.push("admissions_policy", "admissions_strategy");
  }

  return [...new Set(hints)];
}

function parseProfileHints(profile = null, message = "") {
  const text = `${message} ${JSON.stringify(profile ?? {})}`.toLowerCase();
  const stateMatch = text.match(/\b(in|from)\s+([a-z]{2})\b/i) || text.match(/\b(alabama|georgia|california|texas|new york|florida)\b/i);
  const satMatch = text.match(/\bsat[^0-9]{0,12}(\d{3,4})\b/i) || text.match(/\b(\d{3,4})\s+sat\b/i);
  const budgetMatch = text.match(/\$?\s?(\d{2,3}),?(\d{3})\b/);

  return {
    state: profile?.location?.match(/\b([A-Z]{2})\b/)?.[1] ?? profile?.state ?? null,
    sat: profile?.sat ?? (satMatch ? Number(satMatch[1]) : null),
    act: profile?.act ?? null,
    majors: profile?.majors ?? profile?.targetMajors ?? [],
    budget: profile?.budget ?? profile?.financialAidNotes ?? (budgetMatch ? Number(`${budgetMatch[1]}${budgetMatch[2]}`) : null),
    interests: profile?.activities ?? profile?.extracurricularActivities ?? []
  };
}

function scoreRow(row, terms, { sourceTypeHints = [], profileHints = null } = {}) {
  const text = `${row.title ?? ""} ${row.content ?? row.text ?? ""} ${row.searchableText ?? ""}`.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (text.includes(term)) score += 2;
    if (row.category?.toLowerCase().includes(term)) score += 1;
    if (row.sourceType?.toLowerCase().includes(term)) score += 2;
  }

  if (sourceTypeHints.includes(row.sourceType)) score += 8;
  if (sourceTypeHints.includes(row.category)) score += 4;

  if (row.sourceType === "university" && profileHints) {
    const metadata = row.metadata ?? {};
    if (profileHints.state && metadata.state === profileHints.state) score += 12;
    if (profileHints.sat && metadata.satAverage) {
      const delta = Math.abs(profileHints.sat - metadata.satAverage);
      score += Math.max(0, 10 - Math.floor(delta / 40));
    }
    if (profileHints.budget && metadata.totalCost) {
      if (metadata.totalCost <= profileHints.budget) score += 8;
      else score -= 2;
    }
  }

  if (row.sourceType === "scholarship" && /\b(leadership|senior|financial need|minority)\b/i.test(text)) {
    score += 2;
  }

  if (row.sourceType === "summer_program" && /\b(high|extremely high|selective)\b/i.test(text)) {
    score += 1;
  }

  if (row.sourceType === "cs_project" && profileHints?.majors?.some((major) => /cs|computer/i.test(major))) {
    score += 4;
  }

  return score;
}

function normalizeRow(row) {
  return {
    id: row.id,
    category: row.category ?? row.sourceType ?? "general",
    sourceType: row.sourceType ?? row.category ?? "general",
    title: row.title ?? "Knowledge chunk",
    content: row.content ?? row.text ?? "",
    searchableText: row.searchableText ?? "",
    metadata: row.metadata ?? {},
    sourceId: row.sourceId ?? "manual",
    sourceName: row.sourceName ?? row.source ?? "Verified source",
    sourceUrl: row.sourceUrl ?? row.source_url ?? "",
    sourceFile: row.sourceFile ?? null,
    lastVerified: row.lastVerified ?? null
  };
}

async function queryDatabaseKnowledge(message, { limit = 8, profile = null, sourceTypes = null } = {}) {
  const prisma = getPrisma();
  if (!prisma.aiKnowledgeChunk) return [];

  const terms = extractTerms(message);
  const categoryHints = categoryHintsForMessage(message);
  const sourceTypeHints = resolveSourceTypeHints(message, sourceTypes);
  const profileHints = parseProfileHints(profile, message);

  const whereOr = [];
  for (const term of terms) {
    whereOr.push({ content: { contains: term, mode: "insensitive" } });
    whereOr.push({ title: { contains: term, mode: "insensitive" } });
    whereOr.push({ searchableText: { contains: term, mode: "insensitive" } });
  }

  const andClauses = [];
  if (whereOr.length) andClauses.push({ OR: whereOr });
  if (categoryHints.length) andClauses.push({ category: { in: categoryHints } });
  if (sourceTypeHints.length) andClauses.push({ sourceType: { in: sourceTypeHints } });

  const rows = await prisma.aiKnowledgeChunk.findMany({
    where: andClauses.length ? { AND: andClauses } : undefined,
    orderBy: [{ lastVerified: "desc" }, { updatedAt: "desc" }],
    take: 120
  });

  let normalized = rows.map(normalizeRow);
  if (!normalized.length && sourceTypeHints.length) {
    const fallbackRows = await prisma.aiKnowledgeChunk.findMany({
      where: { sourceType: { in: sourceTypeHints } },
      orderBy: [{ updatedAt: "desc" }],
      take: 80
    });
    normalized = fallbackRows.map(normalizeRow);
  }

  normalized.sort((a, b) => scoreRow(b, terms, { sourceTypeHints, profileHints }) - scoreRow(a, terms, { sourceTypeHints, profileHints }));

  if (sourceTypeHints.length) {
    const typedMatches = normalized.filter((row) => sourceTypeHints.includes(row.sourceType));
    if (typedMatches.length) normalized = typedMatches;
  }

  if (sourceTypeHints.includes("university") && profileHints.sat) {
    normalized = normalized.map((row) => {
      if (row.sourceType !== "university") return row;
      const fit = classifyUniversityFit(
        row.metadata?.admissionRate ?? null,
        row.metadata?.satAverage ?? null,
        profileHints.sat
      );
      return fit ? { ...row, metadata: { ...row.metadata, fitCategory: fit } } : row;
    });
  }

  return normalized.slice(0, limit);
}

function loadDashboardCsvFallback() {
  if (dashboardCsvCache) return dashboardCsvCache;
  try {
    dashboardCsvCache = buildDashboardKnowledgeRows({ dataDir: DASHBOARD_DATA_DIR });
  } catch {
    dashboardCsvCache = [];
  }
  return dashboardCsvCache;
}

function resolveSourceTypeHints(message, sourceTypes = null) {
  const fromMessage = sourceTypeHintsForMessage(message);
  if (Array.isArray(sourceTypes) && sourceTypes.length) {
    return [...new Set([...sourceTypes, ...fromMessage])];
  }
  return fromMessage;
}

function queryLocalKnowledge(message, { limit = 8, profile = null, sourceTypes = null } = {}) {
  const sourceTypeHints = resolveSourceTypeHints(message, sourceTypes);
  const dashboardDocs = loadDashboardCsvFallback().map(normalizeRow);
  const verifiedDocs = loadSampleDocs().map(normalizeRow);
  const docs = sourceTypeHints.length ? dashboardDocs : [...verifiedDocs, ...dashboardDocs];
  const terms = extractTerms(message);
  const profileHints = parseProfileHints(profile, message);

  docs.sort(
    (a, b) =>
      scoreRow(b, terms, { sourceTypeHints, profileHints }) -
      scoreRow(a, terms, { sourceTypeHints, profileHints })
  );

  let filtered = docs.filter((row) => scoreRow(row, terms, { sourceTypeHints, profileHints }) > 0);
  if (sourceTypeHints.length) {
    const typedMatches = filtered.filter((row) => sourceTypeHints.includes(row.sourceType));
    if (typedMatches.length) filtered = typedMatches;
  }

  return filtered.slice(0, limit);
}

export async function retrieveKnowledgeChunks(message, { limit = 8, profile = null, sourceTypes = null } = {}) {
  const sourceTypeHints = resolveSourceTypeHints(message, sourceTypes);
  let dbRows = [];
  try {
    dbRows = await queryDatabaseKnowledge(message, { limit, profile, sourceTypes: sourceTypeHints });
  } catch {
    dbRows = [];
  }

  const dbHasRequestedTypes =
    !sourceTypeHints.length || dbRows.some((row) => sourceTypeHints.includes(row.sourceType));

  if (dbRows.length && dbHasRequestedTypes) return dbRows;
  return queryLocalKnowledge(message, { limit, profile, sourceTypes: sourceTypeHints });
}

function formatRecordSummary(chunk) {
  const metadata = chunk.metadata ?? {};

  if (chunk.sourceType === "university") {
    const parts = [
      metadata.city && metadata.state ? `${metadata.city}, ${metadata.state}` : null,
      metadata.admissionRate != null ? `admission ${(metadata.admissionRate * 100).toFixed(1)}%` : null,
      metadata.satAverage != null ? `SAT avg ${metadata.satAverage}` : null,
      metadata.totalCost != null ? `cost $${Math.round(metadata.totalCost).toLocaleString("en-US")}` : null,
      metadata.fitCategory ? `${metadata.fitCategory} fit` : null
    ].filter(Boolean);
    return `${chunk.title}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  if (chunk.sourceType === "scholarship") {
    const parts = [
      metadata.organization,
      metadata.awardAmount ? `award ${metadata.awardAmount}` : null,
      metadata.deadlineMonth ? `deadline ${metadata.deadlineMonth}` : null
    ].filter(Boolean);
    return `${chunk.title}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  if (chunk.sourceType === "summer_program") {
    const parts = [
      metadata.institution,
      metadata.subject,
      metadata.selectivity,
      metadata.costRange ? `cost ${metadata.costRange}` : null
    ].filter(Boolean);
    return `${chunk.title}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  if (chunk.sourceType === "extracurricular") {
    const parts = [metadata.category, metadata.leadershipRoles, metadata.skillsDeveloped].filter(Boolean);
    return `${chunk.title}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  if (chunk.sourceType === "cs_project") {
    const parts = [metadata.projectType, metadata.difficulty, metadata.impactLevel].filter(Boolean);
    return `${chunk.title}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
  }

  const content = chunk.content.replace(/\s+/g, " ").trim();
  return content.length > 320 ? `${content.slice(0, 317)}...` : content;
}

function toRecord(chunk) {
  return {
    type: "knowledge",
    id: chunk.id,
    category: chunk.category,
    sourceType: chunk.sourceType,
    title: chunk.title,
    summary: formatRecordSummary(chunk),
    content: chunk.content,
    metadata: chunk.metadata ?? {},
    source: chunk.sourceName,
    sourceFile: chunk.sourceFile,
    sourceUrl: chunk.sourceUrl,
    lastVerified: chunk.lastVerified
  };
}

function groupHeadingForSourceType(sourceType) {
  const headings = {
    university: "Prelude university recommendations",
    scholarship: "Prelude scholarship matches",
    summer_program: "Prelude summer program options",
    extracurricular: "Prelude extracurricular ideas",
    cs_project: "Prelude CS project ideas",
    sat_report: "SAT readiness context",
    act_report: "ACT readiness context"
  };
  return headings[sourceType] ?? "Verified admissions and career sources";
}

export async function buildKnowledgeRetrieval(message, { limit = 8, profile = null, sourceTypes = null } = {}) {
  const chunks = await retrieveKnowledgeChunks(message, { limit, profile, sourceTypes });
  if (!chunks.length) return { blocks: [], sources: [] };

  const records = chunks.map(toRecord);
  const groupedByType = new Map();

  for (const record of records) {
    const key = record.sourceType ?? record.category ?? "general";
    if (!groupedByType.has(key)) groupedByType.set(key, []);
    groupedByType.get(key).push(record);
  }

  const blocks = [...groupedByType.entries()].map(([sourceType, sourceRecords]) => ({
    heading: groupHeadingForSourceType(sourceType),
    records: sourceRecords
  }));

  const groupedSources = new Map();
  for (const record of records) {
    if (!groupedSources.has(record.source)) groupedSources.set(record.source, []);
    groupedSources.get(record.source).push(record);
  }

  const sources = [...groupedSources.entries()].map(([label, sourceRecords]) => ({
    label,
    records: sourceRecords
  }));

  return { blocks, sources };
}

export function profileMissingForQuestion(message, profile = null) {
  const text = String(message ?? "").toLowerCase();
  const needsSat = /\b(sat|act|score on track|college list|reach|target|safety)\b/.test(text);
  const needsMajor = /\b(major|cs project|computer science profile|stem)\b/.test(text);
  const needsGrade = /\b(next month|timeline|scholarship|grade level)\b/.test(text);

  const missing = [];
  if (needsSat && profile?.sat == null && profile?.act == null) missing.push("SAT or ACT score");
  if (needsMajor && !(profile?.majors?.length || profile?.focus || profile?.targetMajors?.length)) {
    missing.push("intended major or interests");
  }
  if (needsGrade && !profile?.grade && !profile?.graduationYear) missing.push("grade level");

  return missing;
}
