import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@lib": path.resolve(__dirname, "src/lib"),
      "@scripts": path.resolve(__dirname, "src/scripts"),
      "@config": path.resolve(__dirname, "src/config"),
      "@data": path.resolve(__dirname, "src/data"),
      "@components": path.resolve(__dirname, "src/components"),
      "@layouts": path.resolve(__dirname, "src/layouts"),
      "@pages": path.resolve(__dirname, "src/pages"),
      "@styles": path.resolve(__dirname, "src/styles"),
      "@shaders": path.resolve(__dirname, "src/shaders"),
      "@i18n": path.resolve(__dirname, "src/i18n"),
    },
  },
});
