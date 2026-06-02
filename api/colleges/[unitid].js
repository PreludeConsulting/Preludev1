import { createVercelDatasetsHandler } from "../../server/vercelDatasetsHandler.js";

export default async function handler(req, res) {
  const unitid = req.query?.unitid ?? "";
  return createVercelDatasetsHandler(`/api/colleges/${encodeURIComponent(unitid)}`)(req, res);
}
