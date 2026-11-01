import { defineConfig } from "vitest/config";

// Seuls les modules purs (sans React Native) sont testés ici.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
