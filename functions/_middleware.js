import { enforceCloudflareApiRateLimit } from "./_lib/apiRateLimit.js";

export async function onRequest(context) {
  const blocked = await enforceCloudflareApiRateLimit(context);
  if (blocked) return blocked;
  return context.next();
}
