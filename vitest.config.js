import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [react()],
  test: { environment: "edge-runtime", include: ["tests/**/*.test.ts"] },
});
