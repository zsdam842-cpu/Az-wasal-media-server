import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      JWT_SECRET: "test-secret-for-tests",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/wasal_test"
    }
  }
});
