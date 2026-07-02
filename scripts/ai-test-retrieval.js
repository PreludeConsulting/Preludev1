import assert from "node:assert/strict";
import { retrieveKnowledgeChunks } from "../server/rag/knowledgeRetrieval.js";

const TESTS = [
  {
    name: "university retrieval by state and SAT",
    query: "colleges in Georgia with SAT around 1300 and affordable tuition",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "university"));
      assert.ok(rows.some((row) => /georgia|GA/i.test(row.searchableText ?? row.content)));
    }
  },
  {
    name: "scholarship retrieval",
    query: "scholarships for high school seniors with leadership and deadlines",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "scholarship"));
      assert.ok(rows.some((row) => /award|deadline/i.test(row.content)));
    }
  },
  {
    name: "summer program retrieval",
    query: "highly selective summer STEM programs with financial aid",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "summer_program"));
    }
  },
  {
    name: "extracurricular retrieval",
    query: "extracurricular activities for leadership and public speaking",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "extracurricular"));
    }
  },
  {
    name: "CS project retrieval",
    query: "advanced CS project ideas with high impact for college apps",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "cs_project"));
    }
  },
  {
    name: "SAT report retrieval",
    query: "is my SAT score on track with national benchmarks and readiness",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "sat_report"));
    }
  },
  {
    name: "ACT report retrieval",
    query: "ACT benchmark readiness and score interpretation trends",
    expect: (rows) => {
      assert.ok(rows.some((row) => row.sourceType === "act_report"));
    }
  }
];

let failures = 0;

for (const test of TESTS) {
  try {
    const rows = await retrieveKnowledgeChunks(test.query, { limit: 8 });
    test.expect(rows);
    console.log(`✓ ${test.name} (${rows.length} rows)`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${test.name}`);
    console.error(`  ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`[ai:test-retrieval] ${failures} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("[ai:test-retrieval] All retrieval checks passed.");
}
