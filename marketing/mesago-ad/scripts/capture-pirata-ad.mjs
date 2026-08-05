#!/usr/bin/env node
/**
 * Capture ZH product UI from pirata.farvoo.com for MesaGoAdV3.
 *
 * Usage:
 *   MESA_AD_USER=qiantai MESA_AD_PASS=654321 node scripts/capture-pirata-ad.mjs
 *
 * Writes mobile shots under public/ui/flow/ and public/ui/.
 * Does NOT capture kitchen pages.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLOW = join(ROOT, 'public/ui/flow');
const UI = join(ROOT, 'public/ui');
mkdirSync(FLOW, { recursive: true });
mkdirSync(UI, { recursive: true });

const BASE = process.env.MESA_AD_BASE || 'https://pirata.farvoo.com';
const USER = process.env.MESA_AD_USER || 'qiantai';
const PASS = process.env.MESA_AD_PASS || '654321';
const W = Number(process.env.MESA_AD_W || 780);
const H = Number(process.env.MESA_AD_H || 1688);

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function ensureZh(page) {
  await page.evaluate(() => {
    localStorage.setItem('mesa-ui-lang', 'zh');
    document.cookie = 'mesa-ui-lang=zh; path=/; max-age=31536000';
  });
}

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  await page.reload({ waitUntil: 'networkidle2', timeout: 120_000 });
  await wait(800);
  await page.type('input[type="text"], input[type="email"], input:not([type])', USER, {
    delay: 20,
  });
  // Prefer password field
  const pass = await page.$('input[type="password"]');
  if (!pass) throw new Error('password input not found');
  await pass.click({ clickCount: 3 });
  await pass.type(PASS, { delay: 20 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120_000 }),
    page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /登录|Entrar|Login/i.test(b.textContent || ''),
      );
      if (btn) btn.click();
      else document.querySelector('form')?.requestSubmit();
    }),
  ]);
  await ensureZh(page);
  console.log('✓ logged in →', page.url());
}

async function shot(page, path, dest) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  await wait(2200);
  // Hide Next error overlay if any
  await page.evaluate(() => {
    document.querySelector('nextjs-portal')?.remove();
  });
  const out = dest.startsWith('/') ? dest : join(FLOW, dest);
  await page.screenshot({ path: out, type: 'png' });
  console.log('✓', out);
  return out;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${W},${H}`, '--lang=zh-CN'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

  await login(page);

  // Board idle (with open tables visible is fine — real ops)
  await shot(page, '/dashboard/waiter', '01-board-idle.png');
  await page.screenshot({ path: join(UI, 'board-mobile.png'), type: 'png' });
  console.log('✓ board-mobile.png');

  // Open-table dialog on first idle 开台
  await page.goto(`${BASE}/dashboard/waiter`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await wait(2000);
  const opened = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const btn = buttons.find((b) => (b.textContent || '').includes('开台'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (opened) {
    await wait(1200);
    await page.screenshot({ path: join(FLOW, '02-open-dialog.png'), type: 'png' });
    console.log('✓ 02-open-dialog.png');
    // bump adult if + present
    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, div, span')];
      const adult = labels.find((el) => (el.textContent || '').trim() === '成人');
      const row = adult?.closest('div');
      const plus = row && [...row.querySelectorAll('button')].at(-1);
      plus?.click();
      plus?.click();
    });
    await wait(600);
    await page.screenshot({ path: join(FLOW, '03-open-adult.png'), type: 'png' });
    console.log('✓ 03-open-adult.png');
    // dismiss without confirming if cancel exists — avoid mutating prod tables
    const dismissed = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const cancel = buttons.find((b) => /取消|关闭|Cancel/i.test(b.textContent || ''));
      if (cancel) {
        cancel.click();
        return true;
      }
      // Esc / click backdrop
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    });
    console.log(dismissed ? '  dialog cancelled' : '  dialog escape attempted');
  } else {
    console.warn('no 开台 button — skip open dialog shots');
  }

  // Board with open tables as "open" state
  await shot(page, '/dashboard/waiter', '04-board-open.png');

  // Order history list + detail modal (NOT kitchen)
  await shot(page, '/dashboard/orders', '30-order-history.png');
  await page.goto(`${BASE}/dashboard/orders`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  await wait(2000);
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[role="button"]')].filter((el) =>
      /桌/.test(el.textContent || ''),
    );
    cards[0]?.click();
  });
  await wait(1800);
  await page.screenshot({ path: join(FLOW, '31-order-history-detail.png'), type: 'png' });
  console.log('✓ 31-order-history-detail.png');
  await page.keyboard.press('Escape');
  await wait(400);

  // Dashboard overview
  await shot(page, '/dashboard', '05-dashboard.png');
  await page.screenshot({ path: join(UI, 'dashboard-mobile.png'), type: 'png' });

  // Menu (staff)
  await shot(page, '/dashboard/menu', join(UI, 'menu-mobile.png'));

  // Checkout queue
  await shot(page, '/dashboard/checkout', join(UI, 'checkout-mobile.png'));

  // Desktop board
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/dashboard/waiter`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  await wait(2200);
  await page.screenshot({ path: join(UI, 'board-desktop.png'), type: 'png' });
  console.log('✓ board-desktop.png');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await wait(2000);
  await page.screenshot({ path: join(UI, 'dashboard-desktop.png'), type: 'png' });
  console.log('✓ dashboard-desktop.png');
  await page.goto(`${BASE}/dashboard/orders`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await wait(2000);
  await page.screenshot({ path: join(UI, 'orders-desktop.png'), type: 'png' });
  console.log('✓ orders-desktop.png');

  // Persist cookie jar for re-shots
  const cookies = await page.cookies();
  writeFileSync(
    '/tmp/mesa-pirata-qiantai.json',
    JSON.stringify({ base: BASE, user: USER, cookies }, null, 2),
  );
  console.log('✓ cookie jar /tmp/mesa-pirata-qiantai.json');

  await browser.close();
  console.log('Done — pirata ZH captures (no kitchen)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
