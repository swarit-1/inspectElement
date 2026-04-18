import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@intentguard/trace": path.resolve(
        __dirname,
        "packages/trace/src/index.ts"
      ),
    },
  },
  test: {
    globals: true,
    include: ["**/__tests__/**/*.test.ts"],
  },
});
