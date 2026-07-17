import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// FORGE lives in the current repo root alongside unrelated legacy Webflow files
// (README.md, pb-*.js). Those are intentionally excluded from the app build.
export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5175, host: true },
  build: { outDir: "dist", sourcemap: true },
});
