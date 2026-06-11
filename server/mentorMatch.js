import { buildChatModelConfig } from "./aiConfig.js";
import { callChatModel } from "./chatModel.js";

export function isCompletedMentorQuestionnaire(questionnaire) {
  if (!questionnaire || questionnaire.completed !== true) return false;
  const answers = questionnaire.answers;
  return Boolean(answers && typeof answers === "object" && !Array.isArray(answers) && Object.keys(answers).length > 0);
}

export function buildMentorMatchMessages(questionnaire) {
  if (!isCompletedMentorQuestionnaire(questionnaire)) {
    const error = new Error("A completed mentor questionnaire is required.");
    error.code = "MENTOR_QUESTIONNAIRE_REQUIRED";
    throw error;
  }

  return [
    {
      role: "system",
      content: [
        "You support PreludeMatch mentor matching only after a student completes the mentor questionnaire.",
        "Write one concise Prelude mentor recommendation of at most 90 words.",
        "Recommend mentor qualities, relevant experience, and a support style or path that fits the questionnaire.",
        "Do not invent named mentors or claim a specific mentor is available.",
        "Do not promise admission, scholarship, or other outcomes.",
        "Do not mention pricing unless pricing data is explicitly included in the questionnaire.",
        "Do not write or revise essays, provide a full admissions strategy, or answer general admissions questions."
      ].join(" ")
    },
    {
      role: "user",
      content: `Completed PreludeMatch mentor questionnaire:\n${JSON.stringify(questionnaire.answers)}`
    }
  ];
}

export async function createMentorMatch(questionnaire, config = buildChatModelConfig(), modelCaller = callChatModel) {
  const result = await modelCaller(buildMentorMatchMessages(questionnaire), config);
  return {
    summary: result.text,
    provider: result.provider,
    model: result.model
  };
}
