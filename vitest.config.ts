import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.next/**", "**/.deploy-*/**", "**/dist/**"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
