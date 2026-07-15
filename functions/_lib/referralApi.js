/**
 * Cloudflare Pages adapter for referral API routes.
 * Reuses the Node middleware by adapting Fetch Request ↔ Node-like req/res.
 */
import { createReferralApiMiddleware } from "../../../server/referralApi.js";

function envFromContext(context) {
  return {
    ...context.env,
    SUPABASE_URL: context.env?.SUPABASE_URL || context.env?.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: context.env?.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: context.env?.SUPABASE_ANON_KEY || context.env?.VITE_SUPABASE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: context.env?.STRIPE_SECRET_KEY,
    STRIPE_REFERRAL_COUPON_ID: context.env?.STRIPE_REFERRAL_COUPON_ID,
    BILLING_PROVIDER: context.env?.BILLING_PROVIDER,
    RATE_LIMIT_SECRET: context.env?.RATE_LIMIT_SECRET || context.env?.SUPABASE_SERVICE_ROLE_KEY
  };
}

function applyEnv(env) {
  if (typeof process === "undefined") return;
  for (const [key, value] of Object.entries(env)) {
    if (value != null && value !== "" && !process.env[key]) {
      process.env[key] = String(value);
    }
  }
}

async function runReferralMiddleware(context) {
  const env = envFromContext(context);
  applyEnv(env);

  const url = new URL(context.request.url);
  const headers = Object.fromEntries(context.request.headers.entries());
  const bodyText =
    context.request.method === "GET" || context.request.method === "HEAD"
      ? ""
      : await context.request.text();

  let statusCode = 200;
  const responseHeaders = { "Content-Type": "application/json" };
  let responseBody = "";

  const req = {
    method: context.request.method,
    url: url.pathname + url.search,
    headers: {
      ...headers,
      authorization: headers.authorization || headers.Authorization || ""
    },
    body: bodyText
  };

  const res = {
    statusCode: 200,
    setHeader(key, value) {
      responseHeaders[key] = value;
    },
    end(chunk) {
      if (chunk != null) responseBody += String(chunk);
    }
  };

  // Patch sendJson/end path: referral middleware uses sendJson which sets statusCode
  Object.defineProperty(res, "statusCode", {
    get() {
      return statusCode;
    },
    set(value) {
      statusCode = value;
    }
  });

  const middleware = createReferralApiMiddleware(env);
  await new Promise((resolve) => {
    const originalEnd = res.end.bind(res);
    res.end = (chunk) => {
      originalEnd(chunk);
      resolve();
    };
    middleware(req, res, () => {
      statusCode = 404;
      responseBody = JSON.stringify({ error: "not_found" });
      resolve();
    });
  });

  return new Response(responseBody || null, { status: statusCode, headers: responseHeaders });
}

export function onRequest(context) {
  return runReferralMiddleware(context);
}
