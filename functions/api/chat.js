import { handlePreludeChat } from "../_lib/chat.js";

export function onRequest(context) {
  return handlePreludeChat(context);
}
