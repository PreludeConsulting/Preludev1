/**
 * Catch-all for unmatched /api/* routes.
 * Ensures production never falls through to SPA index.html for API paths.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, Stripe-Signature"
      }
    });
  }

  return new Response(
    JSON.stringify({
      error: "API route not found",
      message: `No handler for ${context.request.method} ${url.pathname}`
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
