function formatPercent(rate) {
  if (rate == null) return null;
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCurrency(value) {
  if (value == null) return null;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function buildUniversityRecord(school) {
  return {
    type: "knowledge",
    id: school.id,
    sourceType: "university",
    title: school.metadata.name,
    summary: school.metadata.name,
    metadata: school.metadata,
    source: "Prelude University Database",
    sourceFile: "university_database.csv"
  };
}

function schoolCardMarkdown(meta) {
  const lines = [
    `**${meta.name}**`,
    meta.city && meta.state ? `- **Location:** ${meta.city}, ${meta.state}` : null,
    meta.admissionRate != null ? `- **Admission rate:** ${formatPercent(meta.admissionRate)}` : null,
    meta.satAverage != null ? `- **Average SAT:** ${meta.satAverage}` : null,
    meta.totalCost != null ? `- **Estimated total cost:** ${formatCurrency(meta.totalCost)}` : null,
    meta.tuitionInState != null ? `- **In-state tuition:** ${formatCurrency(meta.tuitionInState)}` : null,
    meta.tuitionOutOfState != null ? `- **Out-of-state tuition:** ${formatCurrency(meta.tuitionOutOfState)}` : null,
    "- **Source:** Prelude University Database"
  ].filter(Boolean);

  return lines.join("\n");
}

function satBenchmarkAdvice(meta, profile = null) {
  const studentSat = profile?.sat ?? null;
  const lines = [];

  if (meta.satAverage != null) {
    lines.push(
      `According to the Prelude University Database, **${meta.name}** lists an average SAT of **${meta.satAverage}**.`
    );
    if (studentSat != null) {
      const delta = studentSat - meta.satAverage;
      if (delta >= 40) {
        lines.push(`Your SAT of **${studentSat}** is above the listed average — a useful benchmark, though admission is still holistic.`);
      } else if (delta >= -40) {
        lines.push(`Your SAT of **${studentSat}** is near the listed average — competitive on tests alone, but not sufficient by itself.`);
      } else {
        lines.push(`Your SAT of **${studentSat}** is below the listed average — you may want a stronger test score or other standout strengths.`);
      }
    } else {
      lines.push("For a selective school, a competitive target is usually at or above the listed average.");
    }
  } else {
    lines.push(`I don't have an SAT average listed for **${meta.name}** in the Prelude University Database.`);
  }

  if (meta.admissionRate != null) {
    lines.push(`The listed admission rate is **${formatPercent(meta.admissionRate)}**, so academics are only one part of a holistic review.`);
  }

  lines.push(
    "I can't guarantee admission, but this gives you a practical benchmark. Strong essays, activities, recommendations, and course rigor still matter."
  );

  return lines.join("\n\n");
}

function admissionPredictionAdvice(meta) {
  const parts = [
    `I can't predict whether you'll be admitted to **${meta.name}**, but here's what the Prelude University Database shows as context:`
  ];

  if (meta.admissionRate != null) parts.push(`- Admission rate: **${formatPercent(meta.admissionRate)}**`);
  if (meta.satAverage != null) parts.push(`- Average SAT: **${meta.satAverage}**`);
  if (meta.totalCost != null) parts.push(`- Estimated total cost: **${formatCurrency(meta.totalCost)}**`);

  parts.push(
    "\nUse this as a benchmark, not a guarantee. A balanced plan usually includes reach, target, and safety schools plus strong application materials."
  );

  return parts.join("\n");
}

export function buildSchoolFactAnswer({ school, topic, questionIntent, profile = null }) {
  const meta = school.metadata;
  const record = buildUniversityRecord(school);
  let body = "";

  switch (topic) {
    case "sat_average":
      body =
        meta.satAverage != null
          ? `According to the Prelude University Database, **${meta.name}**'s average SAT score is **${meta.satAverage}**. That does not guarantee admission, but it is a useful benchmark for how competitive applicants tend to be on tests.`
          : `I don't have an SAT average listed for **${meta.name}** in the Prelude University Database. I can still help using admission rate, cost, and other available fields.`;
      break;
    case "sat_benchmark":
      body = satBenchmarkAdvice(meta, profile);
      break;
    case "admission_rate":
      body =
        meta.admissionRate != null
          ? `According to the Prelude University Database, **${meta.name}** has an admission rate of **${formatPercent(meta.admissionRate)}**.`
          : `I don't have an admission rate listed for **${meta.name}** in the Prelude University Database.`;
      break;
    case "cost":
      body = `Here is cost information for **${meta.name}** from the Prelude University Database:`;
      if (meta.totalCost != null) body += `\n\nEstimated total cost of attendance: **${formatCurrency(meta.totalCost)}**.`;
      if (meta.tuitionInState != null) body += `\nIn-state tuition: **${formatCurrency(meta.tuitionInState)}**.`;
      if (meta.tuitionOutOfState != null) body += `\nOut-of-state tuition: **${formatCurrency(meta.tuitionOutOfState)}**.`;
      if (meta.totalCost == null && meta.tuitionInState == null && meta.tuitionOutOfState == null) {
        body = `I don't have complete cost data listed for **${meta.name}** in the Prelude University Database.`;
      }
      break;
    case "act_average":
      body = `The Prelude University Database does not include ACT averages for **${meta.name}**. I can help with SAT average, admission rate, and cost instead.`;
      break;
    default:
      if (questionIntent === "admission_prediction") {
        body = admissionPredictionAdvice(meta);
      } else {
        body = `Here is what the Prelude University Database shows for **${meta.name}**:`;
      }
  }

  const text = `${body}\n\n${schoolCardMarkdown(meta)}`;

  return {
    text,
    retrievedRecords: [record],
    sourceLabels: ["Prelude University Database"],
    sources: [{ label: "Prelude University Database", records: [record] }],
    conversationState: {
      lastSchool: school,
      lastSchoolName: meta.name,
      lastSchoolUnitId: meta.unitid,
      pendingSchoolTopic: null,
      pendingSchoolIntent: null
    }
  };
}

export function buildSchoolClarificationAnswer({ topic, questionIntent }) {
  const topicHint =
    topic === "sat_benchmark" || topic === "sat_average"
      ? "SAT question"
      : topic === "admission_rate"
        ? "admission rate question"
        : topic === "cost"
          ? "cost question"
          : "school question";

  return {
    text: `I can answer that ${topicHint} using the Prelude University Database. Which school are you asking about?`,
    conversationState: {
      pendingSchoolTopic: topic,
      pendingSchoolIntent: questionIntent
    }
  };
}
