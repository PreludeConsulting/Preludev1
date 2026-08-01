import { handleIntegrations } from "../../../_lib/integrations.js";

export async function onRequest(context) {
  return handleIntegrations(context, "zoom-disconnect");
}
