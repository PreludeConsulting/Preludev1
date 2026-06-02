import "./loadEnv.js";
import { getAiStartupMessage } from "./aiConfig.js";
import http from "node:http";
import { createPreludeApiStack } from "./createApiStack.js";
import { sendJson } from "./http.js";

const port = Number(process.env.PRELUDE_API_PORT ?? process.env.PORT ?? 3001);
const stack = createPreludeApiStack(process.env);

function runStack(req, res) {
  let index = 0;

  const next = (err) => {
    if (err) {
      console.error("[prelude-server]", err);
      if (!res.writableEnded) sendJson(res, 500, { error: "server_error", message: "Request failed." });
      return;
    }

    const layer = stack[index++];
    if (!layer) {
      if (!res.writableEnded) {
        sendJson(res, 404, { error: "not_found", message: "Route not found." });
      }
      return;
    }

    layer(req, res, next);
  };

  next();
}

const server = http.createServer(runStack);

server.listen(port, () => {
  console.log(`Prelude API server listening on http://localhost:${port}`);
  console.log(getAiStartupMessage());
  console.log(
    "Routes: /api/colleges/*, /api/programs/search, /api/careers/search, /api/high-schools/search, /api/chat, /api/auth/*"
  );
});
