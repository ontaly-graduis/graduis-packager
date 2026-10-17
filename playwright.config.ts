// Playwright : la salle jouée dans Chromium, en file://, comme sur le poste d'un animateur.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests-navigateur",
  use: {
    browserName: "chromium",
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
});
