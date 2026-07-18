import { handleBugReport } from "../../_lib/bugReports.js";

export function onRequest(context) {
  return handleBugReport(context);
}
