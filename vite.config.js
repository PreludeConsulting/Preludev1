import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { createChatApiMiddleware } from "./server/chatApi.js";
import { createAuthApiMiddleware } from "./server/authApi.js";

function preludeChatApiPlugin(env) {
  const middleware = createChatApiMiddleware(env);
  const authMiddleware = createAuthApiMiddleware(env);

  return {
    name: "prelude-chat-api",
    configureServer(server) {
      server.middlewares.use(authMiddleware);
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(authMiddleware);
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "/Preludev1/",
    plugins: [react(), preludeChatApiPlugin(env)],
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            motion: ["motion"],
            media: ["hls.js"],
            icons: ["lucide-react"]
          }
        }
      }
    }
  };
});
