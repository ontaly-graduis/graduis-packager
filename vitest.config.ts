// Vitest ne joue que `tests/` : `tests-navigateur/` est à Playwright. Le rejeu du corpus imprime dans Chromium pendant que
// les autres fichiers tournent : les délais par défaut (5 s, 10 s) ne tiennent plus sous cette charge.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/**/*.test.ts"], testTimeout: 30_000, hookTimeout: 60_000 } });
