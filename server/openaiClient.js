export async function callOpenAi(chatMessages, { apiKey, model }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      temperature: 0.6,
      max_tokens: 700
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`OpenAI request failed (${response.status})`);
    error.code = "UPSTREAM_ERROR";
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    const error = new Error("Empty model response");
    error.code = "EMPTY_RESPONSE";
    throw error;
  }

  return { text, model, provider: "openai" };
}
