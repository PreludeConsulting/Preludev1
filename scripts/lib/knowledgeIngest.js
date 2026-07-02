import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { parseCsv } from "./csvParse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, "../..");
export const dashboardDataDir = path.join(repoRoot, "prelude_ai_data", "dashboard");

export const DASHBOARD_SOURCE_TYPES = [
  "university",
  "scholarship",
  "summer_program",
  "extracurricular",
  "cs_project",
  "sat_report",
  "act_report"
];

const DASHBOARD_FILES = {
  university: "university_database.csv",
  scholarship: "scholarship_database.csv",
  summer_program: "summer_program_database.csv",
  extracurricular: "extracurricular_database.csv",
  cs_project: "cs_profile_database.csv",
  sat_report: "sat_report_2025.pdf",
  act_report: "2025-act-profile-report-us.pdf"
};

const SOURCE_LABELS = {
  university: "Prelude University Database",
  scholarship: "Prelude Scholarship Database",
  summer_program: "Prelude Summer Program Database",
  extracurricular: "Prelude Extracurricular Database",
  cs_project: "Prelude CS Project Database",
  sat_report: "SAT 2025 Profile Report",
  act_report: "ACT 2025 Profile Report"
};

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const DEFAULT_LAST_VERIFIED = new Date("2025-07-01T00:00:00.000Z");

function stableId(prefix, parts) {
  const hash = crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `${prefix}_${hash}`;
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

function parseNumber(value) {
  if (value == null || value === "" || String(value).toUpperCase() === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrency(value) {
  if (value == null) return null;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatPercent(value) {
  if (value == null) return null;
  return `${(value * 100).toFixed(1)}%`;
}

function classifyUniversityFit(admRate, satAvg, studentSat) {
  if (admRate == null && satAvg == null) return null;
  if (studentSat != null && satAvg != null) {
    const delta = studentSat - satAvg;
    if (delta >= 80 && (admRate == null || admRate >= 0.35)) return "safety";
    if (delta >= -40 && delta < 80) return "target";
    if (delta < -40 || (admRate != null && admRate < 0.2)) return "reach";
  }
  if (admRate != null) {
    if (admRate >= 0.6) return "safety";
    if (admRate >= 0.25) return "target";
    return "reach";
  }
  return null;
}

function buildUniversityRow(record) {
  const unitid = record.UNITID;
  const name = record.INSTNM;
  const city = record.CITY;
  const state = record.STABBR;
  const admRate = parseNumber(record.ADM_RATE);
  const satAvg = parseNumber(record.SAT_AVG);
  const cost = parseNumber(record.COSTT4_A);
  const tuitionIn = parseNumber(record.TUITIONFEE_IN);
  const tuitionOut = parseNumber(record.TUITIONFEE_OUT);

  const metadata = {
    unitid,
    name,
    city,
    state,
    zip: record.ZIP || null,
    website: record.INSTURL || null,
    admissionRate: admRate,
    satAverage: satAvg,
    totalCost: cost,
    tuitionInState: tuitionIn,
    tuitionOutOfState: tuitionOut
  };

  const contentParts = [
    `${name} in ${city}, ${state}.`,
    admRate != null ? `Admission rate: ${formatPercent(admRate)}.` : null,
    satAvg != null ? `Average SAT: ${satAvg}.` : null,
    cost != null ? `Average total cost of attendance: ${formatCurrency(cost)}.` : null,
    tuitionIn != null ? `In-state tuition: ${formatCurrency(tuitionIn)}.` : null,
    tuitionOut != null ? `Out-of-state tuition: ${formatCurrency(tuitionOut)}.` : null,
    record.INSTURL ? `Website: ${record.INSTURL}.` : null
  ].filter(Boolean);

  const searchableText = [
    name,
    city,
    state,
    record.ZIP,
    "college university admissions",
    admRate != null ? `admission rate ${formatPercent(admRate)}` : null,
    satAvg != null ? `sat ${satAvg}` : null,
    cost != null ? `cost ${cost}` : null,
    tuitionIn != null ? `tuition in state ${tuitionIn}` : null,
    tuitionOut != null ? `tuition out of state ${tuitionOut}` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `dash_univ_${unitid}`,
    sourceId: "prelude_dashboard_university",
    sourceName: SOURCE_LABELS.university,
    sourceUrl: "",
    category: "university",
    sourceFile: DASHBOARD_FILES.university,
    sourceType: "university",
    title: name,
    content: contentParts.join(" "),
    metadata,
    searchableText,
    lastVerified: DEFAULT_LAST_VERIFIED
  };
}

function buildScholarshipRow(record) {
  const title = record.Scholarship_Name;
  const metadata = {
    name: title,
    organization: record.Organization || null,
    eligibility: record.Eligibility || null,
    awardAmount: record.Award_Amount || null,
    deadlineMonth: record.Deadline_Month || null
  };

  const content = [
    `${title} from ${record.Organization || "unknown organization"}.`,
    record.Eligibility ? `Eligibility: ${record.Eligibility}.` : null,
    record.Award_Amount ? `Award amount: ${record.Award_Amount}.` : null,
    record.Deadline_Month ? `Deadline month: ${record.Deadline_Month}.` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: stableId("dash_scholarship", [title, record.Organization]),
    sourceId: "prelude_dashboard_scholarship",
    sourceName: SOURCE_LABELS.scholarship,
    sourceUrl: "",
    category: "scholarship",
    sourceFile: DASHBOARD_FILES.scholarship,
    sourceType: "scholarship",
    title,
    content,
    metadata,
    searchableText: [title, record.Organization, record.Eligibility, record.Award_Amount, record.Deadline_Month]
      .filter(Boolean)
      .join(" "),
    lastVerified: DEFAULT_LAST_VERIFIED
  };
}

function buildSummerProgramRow(record) {
  const title = record.Program_Name;
  const metadata = {
    name: title,
    institution: record.Institution || null,
    subject: record.Subject || null,
    selectivity: record.Selectivity || null,
    costRange: record.Cost_Range || null
  };

  const content = [
    `${title} at ${record.Institution || "various institutions"}.`,
    record.Subject ? `Subject: ${record.Subject}.` : null,
    record.Selectivity ? `Selectivity: ${record.Selectivity}.` : null,
    record.Cost_Range ? `Cost: ${record.Cost_Range}.` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: stableId("dash_summer", [title, record.Institution]),
    sourceId: "prelude_dashboard_summer_program",
    sourceName: SOURCE_LABELS.summer_program,
    sourceUrl: "",
    category: "summer_program",
    sourceFile: DASHBOARD_FILES.summer_program,
    sourceType: "summer_program",
    title,
    content,
    metadata,
    searchableText: [title, record.Institution, record.Subject, record.Selectivity, record.Cost_Range]
      .filter(Boolean)
      .join(" "),
    lastVerified: DEFAULT_LAST_VERIFIED
  };
}

function buildExtracurricularRow(record) {
  const title = record.Activity_Name;
  const metadata = {
    category: record.Category || null,
    name: title,
    description: record.Description || null,
    leadershipRoles: record.Leadership_Roles || null,
    skillsDeveloped: record.Skills_Developed || null
  };

  const content = [
    `${title} (${record.Category || "activity"}).`,
    record.Description ? record.Description : null,
    record.Leadership_Roles ? `Leadership roles: ${record.Leadership_Roles}.` : null,
    record.Skills_Developed ? `Skills developed: ${record.Skills_Developed}.` : null
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: stableId("dash_extracurricular", [title, record.Category]),
    sourceId: "prelude_dashboard_extracurricular",
    sourceName: SOURCE_LABELS.extracurricular,
    sourceUrl: "",
    category: "extracurricular",
    sourceFile: DASHBOARD_FILES.extracurricular,
    sourceType: "extracurricular",
    title,
    content,
    metadata,
    searchableText: [record.Category, title, record.Description, record.Leadership_Roles, record.Skills_Developed]
      .filter(Boolean)
      .join(" "),
    lastVerified: DEFAULT_LAST_VERIFIED
  };
}

function buildCsProjectRow(record) {
  const title = record.Project_Name;
  const metadata = {
    projectType: record.Project_Type || null,
    name: title,
    description: record.Description || null,
    difficulty: record.Difficulty || null,
    impactLevel: record.Impact_Level || null
  };

  const content = [
    `${title} (${record.Project_Type || "CS project"}).`,
    record.Description ? record.Description : null,
    record.Difficulty ? `Difficulty: ${record.Difficulty}.` : null,
    record.Impact_Level ? `Impact level: ${record.Impact_Level}.` : null,
    "Strong CS projects show initiative, technical depth, and measurable impact for college applications."
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: stableId("dash_cs", [title, record.Project_Type]),
    sourceId: "prelude_dashboard_cs_project",
    sourceName: SOURCE_LABELS.cs_project,
    sourceUrl: "",
    category: "cs_project",
    sourceFile: DASHBOARD_FILES.cs_project,
    sourceType: "cs_project",
    title,
    content,
    metadata,
    searchableText: [record.Project_Type, title, record.Description, record.Difficulty, record.Impact_Level, "computer science project portfolio"]
      .filter(Boolean)
      .join(" "),
    lastVerified: DEFAULT_LAST_VERIFIED
  };
}

function buildReportChunks({ sourceType, fileName, title, text }) {
  const chunks = chunkText(text);
  const sourceId = `prelude_dashboard_${sourceType}`;

  return chunks.map((content, index) => ({
    id: stableId(`dash_${sourceType}`, [fileName, String(index), content.slice(0, 80)]),
    sourceId,
    sourceName: SOURCE_LABELS[sourceType],
    sourceUrl: "",
    category: sourceType,
    sourceFile: fileName,
    sourceType,
    title: chunks.length > 1 ? `${title} (part ${index + 1})` : title,
    content,
    metadata: { report: title, chunkIndex: index, chunkCount: chunks.length },
    searchableText: `${title} ${content} sat act benchmark readiness score distribution college career`,
    lastVerified: DEFAULT_LAST_VERIFIED
  }));
}

async function extractPdfText(filePath) {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const buffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(buffer);
  return String(parsed.text ?? "").trim();
}

export function buildDashboardKnowledgeRows({ dataDir = dashboardDataDir } = {}) {
  const rows = [];

  const universityCsv = fs.readFileSync(path.join(dataDir, DASHBOARD_FILES.university), "utf8");
  for (const record of parseCsv(universityCsv)) {
    if (!record.INSTNM) continue;
    rows.push(buildUniversityRow(record));
  }

  for (const record of parseCsv(fs.readFileSync(path.join(dataDir, DASHBOARD_FILES.scholarship), "utf8"))) {
    if (!record.Scholarship_Name) continue;
    rows.push(buildScholarshipRow(record));
  }

  for (const record of parseCsv(fs.readFileSync(path.join(dataDir, DASHBOARD_FILES.summer_program), "utf8"))) {
    if (!record.Program_Name) continue;
    rows.push(buildSummerProgramRow(record));
  }

  for (const record of parseCsv(fs.readFileSync(path.join(dataDir, DASHBOARD_FILES.extracurricular), "utf8"))) {
    if (!record.Activity_Name) continue;
    rows.push(buildExtracurricularRow(record));
  }

  for (const record of parseCsv(fs.readFileSync(path.join(dataDir, DASHBOARD_FILES.cs_project), "utf8"))) {
    if (!record.Project_Name) continue;
    rows.push(buildCsProjectRow(record));
  }

  return rows;
}

export async function buildDashboardReportRows({ dataDir = dashboardDataDir } = {}) {
  const satText = await extractPdfText(path.join(dataDir, DASHBOARD_FILES.sat_report));
  const actText = await extractPdfText(path.join(dataDir, DASHBOARD_FILES.act_report));

  return [
    ...buildReportChunks({
      sourceType: "sat_report",
      fileName: DASHBOARD_FILES.sat_report,
      title: "SAT 2025 Profile Report",
      text: satText
    }),
    ...buildReportChunks({
      sourceType: "act_report",
      fileName: DASHBOARD_FILES.act_report,
      title: "ACT 2025 Profile Report",
      text: actText
    })
  ];
}

export async function buildAllDashboardKnowledgeRows(options = {}) {
  const csvRows = buildDashboardKnowledgeRows(options);
  const reportRows = await buildDashboardReportRows(options);
  return [...csvRows, ...reportRows];
}

export async function upsertKnowledgeRows(rows, options = {}) {
  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;
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
          sourceFile: row.sourceFile,
          sourceType: row.sourceType,
          metadata: row.metadata,
          searchableText: row.searchableText,
          lastVerified: row.lastVerified
        },
        create: row
      });
    }
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}

export async function deleteDashboardKnowledge(options = {}) {
  const prisma = options.prisma ?? new PrismaClient();
  const ownsClient = !options.prisma;
  try {
    const result = await prisma.aiKnowledgeChunk.deleteMany({
      where: {
        sourceType: { in: DASHBOARD_SOURCE_TYPES }
      }
    });
    return result.count;
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}

export { classifyUniversityFit, formatCurrency, formatPercent, parseNumber, SOURCE_LABELS };
