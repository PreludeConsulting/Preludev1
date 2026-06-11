export function isCompletedMentorQuestionnaire(answers) {
  return Boolean(answers && typeof answers === "object" && !Array.isArray(answers) && Object.keys(answers).length > 0);
}

export async function requestMentorMatch(answers) {
  if (!isCompletedMentorQuestionnaire(answers)) return null;

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mentorMatch: {
        completed: true,
        answers
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Mentor matching is unavailable right now.");
  return data;
}
