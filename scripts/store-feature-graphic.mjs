#!/usr/bin/env node
// Rend la bannière Google Play (1024 × 500) depuis apps/mobile/store/feature-graphic.html.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(path.join(ROOT, "apps/web/package.json"))("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.goto(pathToFileURL(path.join(ROOT, "apps/mobile/store/feature-graphic.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(ROOT, "apps/mobile/store/android/feature-graphic.png") });
await browser.close();
