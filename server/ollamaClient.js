function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
}

function isConnectionError(error) {
  const code = error?.cause?.code ?? error?.code;
  return code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ECONNRESET";
}

function parseOllamaErrorBody(raw) {
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    return String(data.error ?? data.message ?? raw);
  } catch {
    return raw;
  }
}

function isModelMissingError(status, detail, model) {
  const text = detail.toLowerCase();
  return (
    status === 404 ||
    text.includes("not found") ||
    text.includes("model") && text.includes(String(model).toLowerCase())
  );
}

export async function callOllama(chatMessages, { baseUrl, model }) {
  const resolvedModel = String(model ?? "gemma3").trim();
  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolvedModel,
        messages: chatMessages,
        stream: false,
        options: { temperature: 0.5, num_predict: 900 }
      }),
      signal: AbortSignal.timeout(120_000)
    });
  } catch (error) {
    if (isConnectionError(error)) {
      const err = new Error(
        'Ollama is not running. Start it with "ollama serve", then try again.'
      );
      err.code = "OLLAMA_NOT_RUNNING";
      throw err;
    }
    const err = new Error("Could not reach Ollama. Check that ollama serve is running.");
    err.code = "OLLAMA_NOT_RUNNING";
    throw err;
  }

  const raw = await response.text();
  const detail = parseOllamaErrorBody(raw);

  if (!response.ok) {
    if (isModelMissingError(response.status, detail, resolvedModel)) {
      const err = new Error(
        `Ollama model "${resolvedModel}" is not available. Run: ollama pull ${resolvedModel}`
      );
      err.code = "OLLAMA_MODEL_NOT_FOUND";
      throw err;
    }

    const err = new Error(detail || `Ollama request failed (${response.status})`);
    err.code = "UPSTREAM_ERROR";
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const err = new Error("Ollama returned an invalid response.");
    err.code = "UPSTREAM_ERROR";
    throw err;
  }

  const text = data.message?.content?.trim();
  if (!text) {
    const err = new Error("Ollama returned an empty response.");
    err.code = "EMPTY_RESPONSE";
    throw err;
  }

  return { text, model: resolvedModel, provider: "ollama" };
}
