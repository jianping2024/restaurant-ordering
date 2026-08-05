#!/usr/bin/env node
/**
 * Capture mobile UI flow screenshots for MesaGoAdV2 (1080×1920 viewport).
 *
 * Usage (from repo root, web on :3000):
 *   node marketing/mesago-ad/scripts/capture-ad-flow.mjs
 *
 * Env:
 *   MESA_AD_BASE=http://localhost:3000
 *   MESA_AD_OWNER=baiyun@gmail.com
 *   MESA_AD_PASSWORD=123456
 *   MESA_AD_SLUG=restaurant-mohnrib5
 */
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const flowDir = join(root, 'public/ui/flow');
mkdirSync(flowDir, { recursive: true });

const BASE = process.env.MESA_AD_BASE || 'http://localhost:3000';
const SLUG = process.env.MESA_AD_SLUG || 'restaurant-mohnrib5';
const OWNER = process.env.MESA_AD_OWNER || 'baiyun@gmail.com';
const PASS = process.env.MESA_AD_PASSWORD || '123456';

const shots = [
  { file: '05-dashboard.png', path: '/dashboard', waitMs: 2500 },
  { file: '06-settings-hub.png', path: '/dashboard/settings', waitMs: 2000 },
  { file: '20-buffet-slots.png', path: '/dashboard/settings/buffet', waitMs: 2500 },
];

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await page.type('input[name="account"], input[type="email"], input[type="text"]', OWNER, {
    delay: 20,
  });
  await page.type('input[name="password"], input[type="password"]', PASS, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120_000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });

  await login(page);

  for (const { file, path, waitMs } of shots) {
    const url = path.startsWith('/dashboard') ? `${BASE}${path}` : `${BASE}/${SLUG}${path}`;
    console.log('capture', file, '←', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120_000 });
    await new Promise((r) => setTimeout(r, waitMs));
    await page.screenshot({ path: join(flowDir, file), type: 'png' });
  }

  // Staff floor board (frontdesk)
  const staffUrl = `${BASE}/${SLUG}/staff/login`;
  console.log('capture staff board ←', staffUrl);
  await page.goto(staffUrl, { waitUntil: 'networkidle2', timeout: 120_000 });
  await page.type('input[name="account"], input[type="text"]', 'qiantai1', { delay: 20 });
  await page.type('input[name="password"], input[type="password"]', '123456', { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120_000 }),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: join(flowDir, '01-board-idle.png'), type: 'png' });

  await browser.close();
  console.log('Saved to', flowDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
