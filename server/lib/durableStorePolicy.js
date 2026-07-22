export function canUseLocalJsonStore(env = process.env) {
  return env.NODE_ENV !== "production";
}

export function assertDurableStoreAvailable(env = process.env, resource = "data") {
  if (canUseLocalJsonStore(env)) return;
  throw Object.assign(new Error(`The durable ${resource} store is temporarily unavailable.`), {
    statusCode: 503,
    code: "durable_store_unavailable"
  });
}
