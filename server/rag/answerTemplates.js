import { classifyUniversityFit } from "../../scripts/lib/knowledgeIngest.js";
import { listUniversities } from "./universityLookup.js";

function formatPercent(rate) {
  if (rate == null) return null;
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  if (value == null) return null;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function toKnowledgeRecord(item) {
  return {
    type: "knowledge",
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    summary: item.summary ?? item.title,
    metadata: item.metadata ?? {},
    source: item.source ?? "Prelude Database",
    sourceFile: item.sourceFile ?? null
  };
}

export function formatUniversityCard(meta) {
  return [
    `**${meta.name}**`,
    meta.city && meta.state ? `- **Location:** ${meta.city}, ${meta.state}` : null,
    meta.admissionRate != null ? `- **Admission rate:** ${formatPercent(meta.admissionRate)}` : null,
    meta.satAverage != null ? `- **Average SAT:** ${meta.satAverage}` : null,
    meta.totalCost != null ? `- **Estimated total cost:** ${formatCurrency(meta.totalCost)}` : null,
    meta.tuitionInState != null ? `- **In-state tuition:** ${formatCurrency(meta.tuitionInState)}` : null,
    meta.tuitionOutOfState != null ? `- **Out-of-state tuition:** ${formatCurrency(meta.tuitionOutOfState)}` : null,
    "- **Source:** Prelude University Database"
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCollegeList({ profile, entities, limit = 6 }) {
  const studentSat = profile?.sat ?? entities.sat ?? null;
  const major = entities.majors?.[0] ?? profile?.majors?.[0] ?? null;
  const state = entities.state ?? profile?.location?.match(/\b([A-Z]{2})\b/)?.[1] ?? null;
  const budget = entities.budget ?? profile?.budget ?? null;

  let candidates = listUniversities().filter((school) => {
    const meta = school.metadata;
    if (state && meta.state !== state) return false;
    if (budget && meta.totalCost && meta.totalCost > budget * 1.25) return false;
    if (studentSat && meta.satAverage && meta.satAverage > studentSat + 180) return false;
    return meta.admissionRate != null || meta.satAverage != null;
  });

  if (!candidates.length) candidates = listUniversities().slice(0, limit * 3);

  const scored = candidates.map((school) => {
    const meta = school.metadata;
    const fit = classifyUniversityFit(meta.admissionRate, meta.satAverage, studentSat) ?? "target";
    let score = 0;
    if (state && meta.state === state) score += 4;
    if (studentSat && meta.satAverage) score += Math.max(0, 8 - Math.abs(studentSat - meta.satAverage) / 40);
    if (budget && meta.totalCost) score += meta.totalCost <= budget ? 5 : -2;
    return { school, fit, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const buckets = { reach: [], target: [], safety: [] };
  for (const item of scored) {
    buckets[item.fit]?.push(item);
  }

  const picks = [
    ...buckets.reach.slice(0, 2),
    ...buckets.target.slice(0, 2),
    ...buckets.safety.slice(0, 2)
  ].slice(0, limit);

  const fitLabel = (fit) => (fit === "safety" ? "likely" : fit);

  const lines = picks.map(({ school, fit }, index) => {
    const meta = school.metadata;
    const why = [
      fit ? `${fitLabel(fit)} fit` : null,
      meta.satAverage != null ? `SAT avg ${meta.satAverage}` : null,
      meta.admissionRate != null ? formatPercent(meta.admissionRate) : null,
      meta.totalCost != null ? formatCurrency(meta.totalCost) : null
    ]
      .filter(Boolean)
      .join(" · ");
    return `${index + 1}. **${meta.name}** (${why})`;
  });

  const records = picks.map(({ school }) => toKnowledgeRecord(school));

  const intro = major
    ? `Here is a starting **reach / target / likely** list from the Prelude University Database for **${major}**${state ? ` in **${state}**` : ""}:`
    : `Here is a starting **reach / target / likely** list from the Prelude University Database:`;

  return {
    text: [
      intro,
      "",
      lines.join("\n"),
      "",
      "These are starting points — not guarantees. Verify current requirements, costs, and deadlines on each school's official site."
    ].join("\n"),
    retrievedRecords: records,
    sourceLabels: ["Prelude University Database"]
  };
}

export function formatKnowledgeRecords(title, records, footer) {
  const lines = records.slice(0, 6).map((record, index) => {
    const prefix = record.title ? `**${record.title}:** ` : "";
    return `${index + 1}. ${prefix}${record.summary ?? record.content ?? ""}`;
  });

  return {
    text: [title, "", lines.join("\n"), "", footer].filter(Boolean).join("\n"),
    retrievedRecords: records.map(toKnowledgeRecord),
    sourceLabels: [...new Set(records.map((record) => record.source).filter(Boolean))]
  };
}

export function formatGuidanceAnswer({ title, bullets, footer, sourceLabel = "Prelude admissions guidance" }) {
  return {
    text: [title, "", bullets.map((line) => `- ${line}`).join("\n"), "", footer, "", `Source: ${sourceLabel}`].join("\n"),
    retrievedRecords: [],
    sourceLabels: [sourceLabel]
  };
}
