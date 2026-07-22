export function canUseLocalJsonStore(env = process.env) {
  return env.NODE_ENV !== "production";
}

export function assertDurableStoreAvailable(env = process.env, resource = "data") {
  if (canUseLocalJsonStore(env)) return;
  const error = new Error(`The durable ${resource} store is temporarily unavailable.`);
  error.statusCode = 503;
  error.code = "durable_store_unavailable";
  throw error;
}
