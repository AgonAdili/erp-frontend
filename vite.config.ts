/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Same-origin in production (nginx serves the SPA at / and proxies /api, /oidc, /files);
// in development Vite proxies them to Django on :8000 so cookies and CSRF behave the same.
const backend = process.env.EACORE_BACKEND ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: false },
      "/oidc": { target: backend, changeOrigin: false },
      "/files": { target: backend, changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: true, target: "es2022" },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
