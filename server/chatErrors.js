const CLIENT_ERROR_STATUS = {
  NOT_CONFIGURED: 503,
  DATABASE_NOT_FOUND: 503,
  OLLAMA_NOT_RUNNING: 503,
  OLLAMA_MODEL_NOT_FOUND: 503,
  BAD_REQUEST: 400
};

const CLIENT_ERROR_CODES = new Set(Object.keys(CLIENT_ERROR_STATUS));

export function mapChatError(error) {
  if (error?.code === "MENTOR_QUESTIONNAIRE_REQUIRED") {
    return {
      status: 400,
      body: { error: "mentor_questionnaire_required", message: error.message }
    };
  }
  if (error.code && CLIENT_ERROR_CODES.has(error.code)) {
    return {
      status: CLIENT_ERROR_STATUS[error.code],
      body: { error: error.code.toLowerCase(), message: error.message }
    };
  }

  return {
    status: 502,
    body: {
      error: "upstream_error",
      message: error.message ?? "Chat request failed. Please try again."
    }
  };
}

export function shouldLogChatError(error) {
  return error.code === "UPSTREAM_ERROR" || !error.code || error.code === "EMPTY_RESPONSE";
}
