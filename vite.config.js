import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { createPreludeApiStack } from "./server/createApiStack.js";

function preludeApiPlugin(env, embedApi) {
  const stack = createPreludeApiStack(env);

  return {
    name: "prelude-api",
    configureServer(server) {
      if (!embedApi) return;
      for (const layer of stack) {
        server.middlewares.use(layer);
      }
    },
    configurePreviewServer(server) {
      if (!embedApi) return;
      for (const layer of stack) {
        server.middlewares.use(layer);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  const apiPort = env.PRELUDE_API_PORT ?? process.env.PRELUDE_API_PORT ?? "3001";
  const useStandaloneApi = (env.PRELUDE_STANDALONE_API ?? process.env.PRELUDE_STANDALONE_API) === "1";
  const embedApi = !useStandaloneApi;

  return {
    base: "/Preludev1/",
    plugins: [react(), preludeApiPlugin(env, embedApi)],
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
