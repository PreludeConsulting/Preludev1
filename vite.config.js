import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** Dev-only API middleware — dynamic import keeps server/ out of deploy parsers. */
function preludeDevApiPlugin(env, embedApi) {
  return {
    name: "prelude-api-dev",
    async configureServer(server) {
      if (!embedApi) return;
      const { createPreludeApiStack } = await import("./server/createApiStack.js");
      for (const layer of createPreludeApiStack(env)) {
        server.middlewares.use(layer);
      }
    },
    async configurePreviewServer(server) {
      if (!embedApi) return;
      const { createPreludeApiStack } = await import("./server/createApiStack.js");
      for (const layer of createPreludeApiStack(env)) {
        server.middlewares.use(layer);
      }
    }
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  const apiPort = env.PRELUDE_API_PORT ?? process.env.PRELUDE_API_PORT ?? "3001";
  const useStandaloneApi = (env.PRELUDE_STANDALONE_API ?? process.env.PRELUDE_STANDALONE_API) === "1";
  const embedApi = !useStandaloneApi;
  const isDevServer = command === "serve";

  return {
    base: "/",
    plugins: [react(), ...(isDevServer ? [preludeDevApiPlugin(env, embedApi)] : [])],
    server: useStandaloneApi
      ? {
          proxy: {
            "/api": {
              target: `http://localhost:${apiPort}`,
              changeOrigin: true
            }
          }
        }
      : undefined,
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/.test(id)) return "react";
            if (/[\\/]node_modules[\\/]motion[\\/]/.test(id)) return "motion";
            if (/[\\/]node_modules[\\/]hls\.js[\\/]/.test(id)) return "media";
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return "icons";
            return undefined;
          }
        }
      }
    }
  };
});
