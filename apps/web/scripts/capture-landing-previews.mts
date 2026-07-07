/**
 * Capture landing preview PNGs into apps/web/public/landing/.
 *
 * Usage (from repo root, dev server on :3000):
 *   npx playwright install chromium
 *   npm run dev
 *   node --import tsx apps/web/scripts/capture-landing-previews.mts
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { LANDING_PREVIEW_SCREEN_META } from '../src/lib/landing/preview-screens';

const BASE_URL = process.env.LANDING_PREVIEW_BASE_URL ?? 'http://localhost:3000';
const OUTPUT_DIR = path.resolve('apps/web/public/landing');

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  'waiter-open': { width: 900, height: 900 },
  menu: { width: 430, height: 900 },
  kitchen: { width: 1200, height: 800 },
  bill: { width: 430, height: 900 },
  dashboard: { width: 1200, height: 800 },
};

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const screen of LANDING_PREVIEW_SCREEN_META) {
    const viewport = VIEWPORTS[screen.id] ?? { width: 1200, height: 800 };
    await page.setViewportSize(viewport);
    await page.goto(`${BASE_URL}${screen.route}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: path.join(OUTPUT_DIR, screen.captureFile),
      fullPage: true,
    });
    console.log(`wrote ${screen.captureFile}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
