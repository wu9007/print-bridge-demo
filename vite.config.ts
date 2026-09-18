import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias:
      mode === "local"
        ? {
            "@yinshu-print/print-zpl": path.resolve(root, "packages/print-zpl/src/index.ts"),
          }
        : {},
  },
  build: {
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
}));
