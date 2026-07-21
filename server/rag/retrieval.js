import { searchCareers, getCareerSkills } from "../datasets/careers.js";
import { searchColleges, getCollegeByUnitId } from "../datasets/colleges.js";
import { resolveCollegesFromText } from "../datasets/collegeAliases.js";
import { normalizeMajorTerm } from "../datasets/majorSynonyms.js";
import { searchHighSchools } from "../datasets/highSchools.js";
import { searchPrograms } from "../datasets/programs.js";
import {
  COLLEGE_SCORECARD_SOURCE,
  NCES_CCD_SOURCE,
  ONET_SOURCE
} from "../datasets/sources.js";
import { buildComparisonFromText, compareColleges } from "./collegeComparison.js";
import { buildRetrievalQuery } from "./conversationHistory.js";
import { deriveConversationState } from "./conversationState.js";
import { parseCorrection } from "./corrections.js";
import {
  classifyIntent,
  extractAffordabilityCap,
  extractMajorTerms,
  extractState
} from "./intent.js";
import { isGuaranteeRequest } from "./guaranteeIntent.js";

function sourceEntry(label, records) {
  return { label, records };
}

function formatCollegeRecord(college) {
  const parts = [
    college.name,
    [college.city, college.state].filter(Boolean).join(", "),
    college.averageNetPrice != null ? `avg net price $${college.averageNetPrice}` : null,
    college.admissionRate != null ? `admission rate ${(college.admissionRate * 100).toFixed(1)}%` : null,
    college.website ? `website ${college.website}` : null
  ].filter(Boolean);
  return {
    type: "college",
    id: college.unitid,
    summary: parts.join(" · "),
    source: college.source ?? COLLEGE_SCORECARD_SOURCE
  };
}

function formatHighSchoolRecord(school) {
  const address = [school.streetAddress, school.city, school.state, school.zip]
    .filter(Boolean)
    .join(", ");
  const parts = [
    school.schoolName,
    address ? `address ${address}` : null,
    school.districtName ? `district ${school.districtName}` : null,
    school.lowestGrade && school.highestGrade
      ? `grades ${school.lowestGrade}-${school.highestGrade}`
      : null,
    school.phone ? `phone ${school.phone}` : null
  ].filter(Boolean);
  return {
    type: "high_school",
    id: school.ncesSchoolId,
    summary: parts.join(" · "),
    source: school.source ?? NCES_CCD_SOURCE
  };
}

function formatProgramRecord(program) {
  const parts = [
    program.institutionName,
    program.programDescription,
    program.credentialDescription,
    program.medianEarnings1yr != null ? `median earnings 1yr $${program.medianEarnings1yr}` : null
  ].filter(Boolean);
  return {
    type: "program",
    id: program.unitid,
    summary: parts.join(" · "),
    source: program.source ?? COLLEGE_SCORECARD_SOURCE
  };
}

function formatCareerRecord(career, tasks = []) {
  const summary = tasks.length
    ? `${career.title} — ${career.description?.slice(0, 180)}… Sample tasks: ${tasks.slice(0, 2).join("; ")}`
    : `${career.title} — ${career.description?.slice(0, 220)}`;
  return {
    type: "career",
    id: career.code,
    summary,
    source: career.source ?? ONET_SOURCE
  };
}

function compareUnitIds(message) {
  const ids = [...message.matchAll(/\b(\d{6,7})\b/g)].map((match) => match[1]);
  return [...new Set(ids)].slice(0, 3);
}

function extractHighSchoolQuery(message) {
  const cleaned = message
    .replace(/\b(where is|located|address of|location of|tell me about|what is|high school)\b/gi, " ")
    .replace(/\?/g, " ")
    .trim();
  return cleaned || message.trim();
}

function retrieveHighSchools(message, state) {
  const query = extractHighSchoolQuery(message);
  const { results } = searchHighSchools({ q: query, state, limit: 8 });
  const records = results.map(formatHighSchoolRecord);
  if (!records.length) {
    return {
      intent: "high_school_search",
      blocks: [
        {
          heading: "Verified high school records",
          records: [
            {
              type: "notice",
              id: "no-high-school-match",
              summary:
                "No verified NCES public high school record matched this question. Do not guess a location or address.",
              source: NCES_CCD_SOURCE
            }
          ]
        }
      ],
      sources: []
    };
  }

  if (records.length > 1) {
    const topScoreGapLikelyAmbiguous = records.length >= 2;
    if (topScoreGapLikelyAmbiguous) {
      return {
        intent: "high_school_search",
        blocks: [
          {
            heading: "Possible verified high school matches (NCES)",
            records
          }
        ],
        sources: [sourceEntry(NCES_CCD_SOURCE, records)],
        multipleMatches: true
      };
    }
  }

  return {
    intent: "high_school_search",
    blocks: [{ heading: "Verified high school record (NCES)", records: records.slice(0, 3) }],
    sources: [sourceEntry(NCES_CCD_SOURCE, records.slice(0, 3))]
  };
}

function retrieveCollegesByNames(names, state) {
  const records = [];
  for (const name of names) {
    const schools = resolveCollegesFromText(name);
    for (const school of schools) {
      const formatted = formatCollegeRecord(school.verifiedCollegeRecord);
      if (!records.some((row) => row.id === formatted.id)) {
        records.push(formatted);
      }
    }
    if (!schools.length) {
      const { results } = searchColleges({ q: name, state, limit: 2 });
      for (const college of results) {
        const formatted = formatCollegeRecord(college);
        if (!records.some((row) => row.id === formatted.id)) {
          records.push(formatted);
        }
      }
    }
  }
  return records;
}

function isComparisonQuery(text) {
  return (
    /\b(compare|versus|vs\.?|better than|which is better|which one is better)\b/i.test(text) ||
    (resolveCollegesFromText(text).length >= 2 && /\b(for|in)\b/i.test(text))
  );
}

function retrieveCollegeSearch(conversationState, message) {
  const state = conversationState.state ?? extractState(message);
  const major = normalizeMajorTerm(conversationState.intendedMajor ?? extractMajorTerms(message)[0] ?? "");
  const maxNetPrice =
    conversationState.budget ??
    extractAffordabilityCap(message) ??
    (/\b(afford|cheap|budget|10k|\$\d)/i.test(message) ? conversationState.budget : null);

  const { results } = searchColleges({
    q: "",
    state,
    major,
    maxNetPrice: maxNetPrice ?? "",
    limit: 8
  });

  const collegeRecords = results.map(formatCollegeRecord);
  const blocks = [];
  const sources = [];

  if (collegeRecords.length) {
    blocks.push({ heading: "College matches (College Scorecard)", records: collegeRecords });
    sources.push(sourceEntry(COLLEGE_SCORECARD_SOURCE, collegeRecords));
  }

  return {
    intent: "school_search",
    blocks,
    sources,
    major,
    priority: conversationState.priority
  };
}

export function retrieveContext(message, conversationHistory = []) {
  if (isGuaranteeRequest(message)) {
    return {
      intent: "guarantee_refusal",
      blocks: [],
      sources: [],
      conversationState: {}
    };
  }

  const conversationState = deriveConversationState(message, conversationHistory);
  const correction = parseCorrection(message, conversationState);

  if (correction?.schoolsUnderDiscussion?.length) {
    conversationState.schoolsUnderDiscussion = correction.schoolsUnderDiscussion;
  }

  const { query, intentMessage } = buildRetrievalQuery(message, conversationHistory);
  const classification = classifyIntent(intentMessage);
  let { intent, needsRetrieval } = classification;
  const state = conversationState.state || extractState(query) || extractState(message);
  const majors = extractMajorTerms(query);
  const major = normalizeMajorTerm(conversationState.intendedMajor || majors[0] || "");
  const maxNetPrice = conversationState.budget ?? extractAffordabilityCap(query);
  const currentMessageSchools = resolveCollegesFromText(message);
  const comparisonNames = extractInstitutionNamesFromComparison(query, conversationState);
  const comparisonQuery = isComparisonQuery(query) || comparisonNames.length >= 2;
  const recognizedCurrentCollege = currentMessageSchools.length >= 1;

  const shouldRetrieve =
    needsRetrieval ||
    comparisonQuery ||
    (recognizedCurrentCollege && intent !== "guarantee_refusal") ||
    (comparisonNames.length >= 1 &&
      /\b(cheaper|more affordable|afford|cost|net price|tuition|compare|better|worse|stronger|located|address|vs\.?|versus)\b/i.test(
        query
      )) ||
    (conversationState.state && conversationState.intendedMajor);

  if (!shouldRetrieve) {
    return {
      intent,
      blocks: [],
      sources: [],
      conversationState
    };
  }

  if (intent === "high_school_search") {
    return { ...retrieveHighSchools(query, state), conversationState };
  }

  if (correction?.isCorrection && correction.schoolsUnderDiscussion.length >= 1) {
    const comparison = compareColleges({
      schools: correction.schoolsUnderDiscussion,
      major: conversationState.intendedMajor || normalizeMajorTerm(extractMajorTerms(query)[0] || "")
    });
    if (comparison.blocks.length) {
      return {
        ...comparison,
        intent: "college_comparison",
        correctionAcknowledgment: correction.acknowledgment,
        conversationState: {
          ...conversationState,
          schoolsUnderDiscussion: correction.schoolsUnderDiscussion
        },
        priority: conversationState.priority
      };
    }
  }

  if (comparisonQuery) {
    const comparison = buildComparisonFromText(query, conversationState);
    if (comparison.blocks.length) {
      return {
        ...comparison,
        intent: "college_comparison",
        conversationState,
        priority: conversationState.priority
      };
    }
  }

  if (comparisonNames.length >= 2) {
    const records = retrieveCollegesByNames(comparisonNames, state);
    if (records.length) {
      return {
        intent: "college_comparison",
        blocks: [{ heading: "Colleges referenced in conversation", records }],
        sources: [sourceEntry(COLLEGE_SCORECARD_SOURCE, records)],
        major,
        conversationState,
        priority: conversationState.priority
      };
    }
  }

  if (recognizedCurrentCollege && comparisonNames.length === 1) {
    const records = retrieveCollegesByNames(comparisonNames, state);
    if (records.length) {
      return {
        intent: "school_search",
        blocks: [{ heading: "College referenced in conversation", records }],
        sources: [sourceEntry(COLLEGE_SCORECARD_SOURCE, records)],
        major,
        conversationState,
        priority: conversationState.priority
      };
    }
  }

  if (
    comparisonNames.length >= 1 &&
    /\b(cheaper|more affordable|afford|cost|net price|tuition|compare|better|worse|stronger|vs\.?|versus)\b/i.test(
      query
    )
  ) {
    const records = retrieveCollegesByNames(comparisonNames, state);
    if (records.length) {
      return {
        intent: intent === "affordability" ? intent : "college_comparison",
        blocks: [{ heading: "Colleges referenced for cost comparison", records }],
        sources: [sourceEntry(COLLEGE_SCORECARD_SOURCE, records)],
        major,
        conversationState,
        priority: conversationState.priority
      };
    }
  }

  if (intent === "career_exploration") {
    const careerQuery =
      majors[0] || query.replace(/\b(career|careers|job|jobs|related to|working with)\b/gi, "").trim() || "psychology";
    const { results } = searchCareers({ q: careerQuery, limit: 8 });
    const records = results.map((career) => formatCareerRecord(career, getCareerSkills(career.code, 2)));
    if (records.length) {
      return {
        intent,
        blocks: [{ heading: "Career matches (O*NET)", records }],
        sources: [sourceEntry(ONET_SOURCE, records)],
        conversationState
      };
    }
    return { intent, blocks: [], sources: [], conversationState };
  }

  if (
    conversationState.state &&
    conversationState.intendedMajor &&
    (conversationState.budget != null || conversationState.priority || /\b\d+\s*k\b/i.test(message))
  ) {
    return { ...retrieveCollegeSearch(conversationState, message), conversationState };
  }

  if (intent === "major_program_search" && !conversationState.state) {
    const programQuery = major || query;
    const { results } = searchPrograms({ q: programQuery, state, limit: 8 });
    const records = results.map(formatProgramRecord);
    if (records.length) {
      return {
        intent,
        blocks: [{ heading: "Program matches (College Scorecard)", records }],
        sources: [sourceEntry(COLLEGE_SCORECARD_SOURCE, records)],
        major,
        conversationState
      };
    }
  }

  if (intent === "school_comparison") {
    const unitids = compareUnitIds(query);
    const records = [];
    for (const unitid of unitids) {
      const college = getCollegeByUnitId(unitid);
      if (college) records.push(formatCollegeRecord(college));
    }

    const names = comparisonNames.length ? comparisonNames : extractInstitutionNamesFromComparison(query, conversationState);
    records.push(...retrieveCollegesByNames(names, state));

    const unique = [];
    const seen = new Set();
    for (const record of records) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      unique.push(record);
    }

    if (unique.length) {
      return {
        intent: "college_comparison",
        blocks: [{ heading: "Colleges requested for comparison", records: unique }],
        sources: [sourceEntry(COLLEGE_SCORECARD_SOURCE, unique)],
        major,
        conversationState,
        priority: conversationState.priority
      };
    }
  }

  const searchQuery =
    intent === "affordability"
      ? ""
      : query.replace(/\b(affordable|cheap|best|good|what is the|what's the|top)\b/gi, "").trim();

  const { results } = searchColleges({
    q: major ? "" : searchQuery,
    state,
    major,
    maxNetPrice: maxNetPrice ?? (intent === "affordability" ? 25000 : ""),
    limit: 8
  });

  const collegeRecords = results.map(formatCollegeRecord);
  const blocks = [];
  const sources = [];

  if (collegeRecords.length) {
    blocks.push({ heading: "College matches (College Scorecard)", records: collegeRecords });
    sources.push(sourceEntry(COLLEGE_SCORECARD_SOURCE, collegeRecords));
  }

  return { intent, blocks, sources, major, conversationState, priority: conversationState.priority };
}

function extractInstitutionNamesFromComparison(query, conversationState) {
  const fromQuery = resolveCollegesFromText(query).map((school) => school.canonicalName);
  const fromState = (conversationState.schoolsUnderDiscussion ?? []).map((school) => school.canonicalName);
  return [...new Set([...fromQuery, ...fromState])].slice(0, 4);
}
