import { handlePreludeMatchSubmit } from "../../_lib/preludeMatchSubmit.js";

export function onRequest(context) {
  return handlePreludeMatchSubmit(context);
}
