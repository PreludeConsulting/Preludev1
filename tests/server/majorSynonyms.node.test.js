import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMajorKey, normalizeMajorTerm } from "../../server/datasets/majorSynonyms.js";

describe("major synonym normalization", () => {
  it("normalizes punctuation, spacing, and case before alias lookup", () => {
    assert.equal(normalizeMajorKey("  Comp-Sci... "), "comp sci");
    assert.equal(normalizeMajorTerm("Comp-Sci"), "computer science");
  });

  it("does not handle college-name typos in the major synonym layer", () => {
    assert.equal(normalizeMajorTerm("Gerogia state university"), "gerogia state university");
  });

  it("normalizes selective-applicant abbreviations to canonical major terms", () => {
    assert.equal(normalizeMajorTerm("industrial eng"), "industrial engineering");
    assert.equal(normalizeMajorTerm("MSE"), "materials science");
    assert.equal(normalizeMajorTerm("poli sci"), "political science");
    assert.equal(normalizeMajorTerm("pre med"), "pre-med");
  });

  it("covers common engineering, computing, social science, and pre-professional aliases", () => {
    assert.equal(normalizeMajorTerm("ECE"), "electrical engineering");
    assert.equal(normalizeMajorTerm("comp eng"), "computer engineering");
    assert.equal(normalizeMajorTerm("AI"), "artificial intelligence");
    assert.equal(normalizeMajorTerm("ml"), "machine learning");
    assert.equal(normalizeMajorTerm("econ"), "economics");
    assert.equal(normalizeMajorTerm("IR"), "international relations");
    assert.equal(normalizeMajorTerm("cogsci"), "cognitive science");
    assert.equal(normalizeMajorTerm("pre-law"), "pre-law");
  });
});
