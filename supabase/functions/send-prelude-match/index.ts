/**
 * Deno/Supabase Edge Function: retired.
 * Canonical writer is POST /api/prelude-match/submit (Cloudflare / Node).
 */
const ALLOWED_ORIGINS = new Set([
  "https://preludeconsultingllc.com",
  "https://www.preludeconsultingllc.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);

function corsHeaders(req) {
  const origin = req.headers.get("Origin") || "";
  const headers = {
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "gone",
      message: "This endpoint is retired. Submit Prelude Match via POST /api/prelude-match/submit."
    }),
    {
      status: 410,
      headers: {
        ...corsHeaders(req),
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
});
