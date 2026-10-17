// Vitest ne joue que `tests/` : `tests-navigateur/` est à Playwright.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
