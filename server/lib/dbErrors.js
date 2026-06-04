/** Maps Prisma / connection failures to safe API responses (no raw ORM text in production UI). */

export const DB_UNAVAILABLE_MESSAGE =
  "The local development database is unavailable. Start the database and try again.";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isDatabaseUnavailableError(error) {
  if (!error) return false;
  const message = String(error.message || "");
  const code = error.code || error.cause?.code;
  return (
    error.name === "PrismaClientInitializationError" ||
    message.includes("Can't reach database server") ||
    message.includes("PrismaClientInitializationError") ||
    message.includes("ECONNREFUSED") ||
    message.includes("Connection refused") ||
    code === "ECONNREFUSED" ||
    code === "P1001"
  );
}

/**
 * @returns {{ statusCode: number, error: string, message: string, log: boolean }}
 */
export function formatAuthApiError(error) {
  if (isDatabaseUnavailableError(error)) {
    return {
      statusCode: 503,
      error: "database_unavailable",
      message: DB_UNAVAILABLE_MESSAGE,
      log: true
    };
  }

  const statusCode = error?.statusCode || 500;
  const isServerError = statusCode >= 500;

  return {
    statusCode,
    error:
      statusCode === 401
        ? "unauthenticated"
        : statusCode === 403
          ? "forbidden"
          : isServerError
            ? "server_error"
            : "request_failed",
    message:
      isServerError && isProduction()
        ? "Something went wrong. Please try again later."
        : error?.message || "Request failed.",
    log: isServerError
  };
}

export function logAuthApiError(error, formatted) {
  if (!formatted.log) return;
  if (isProduction()) {
    console.error("[prelude-auth-api]", formatted.error, error?.message || error);
    return;
  }
  console.error("[prelude-auth-api]", error);
}
