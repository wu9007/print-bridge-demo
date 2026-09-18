import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "YinshuPrintZpl",
      formats: ["es"],
      fileName: (format) => `print-zpl.${format}.js`,
    },
    outDir: path.resolve(__dirname, "dist"),
    assetsInlineLimit: 100 * 1024,
  },
});
