#!/usr/bin/env node
/**
 * Capture clean (no privacy blur) mobile screenshots for MesaGoAdV2.
 * Uses /tmp/mesa-uat/{owner,staff}.json cookies from mesa-local-uat login.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLOW = join(ROOT, 'public/ui/flow');
const UI = join(ROOT, 'public/ui');
mkdirSync(FLOW, { recursive: true });

const BASE = process.env.MESA_AD_BASE || 'http://localhost:3000';
const SLUG = process.env.MESA_AD_SLUG || 'restaurant-mohnrib5';
const W = 780;
const H = 1688;

function loadCookies(jarName) {
  const jar = JSON.parse(readFileSync(`/tmp/mesa-uat/${jarName}.json`, 'utf8'));
  const raw = jar.cookie || '';
  return raw
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      const value = pair.slice(i + 1);
      return {
        name,
        value,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
      };
    });
}

async function shot(page, path, file) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 2200));
  const dest = file.startsWith('/') ? file : join(FLOW, file);
  await page.screenshot({ path: dest, type: 'png' });
  console.log('✓', dest);
}

async function main() {
  // Ensure logins
  const { execFileSync } = await import('node:child_process');
  const repo = join(ROOT, '../..');
  execFileSync('node', ['scripts/mesa-local-uat.mjs', 'login', '--role', 'owner'], {
    cwd: repo,
    stdio: 'inherit',
  });
  execFileSync('node', ['scripts/mesa-local-uat.mjs', 'login', '--role', 'staff'], {
    cwd: repo,
    stdio: 'inherit',
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: [`--window-size=${W},${H}`],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  // Owner captures
  await page.setCookie(...loadCookies('owner'));
  await shot(page, '/dashboard', '05-dashboard.png');
  await shot(page, '/dashboard/settings', '06-settings-hub.png');
  await shot(page, '/dashboard/settings/buffet', '20-buffet-hub.png');

  // Buffet tabs — click 时段 / 价目表 if present
  await page.goto(`${BASE}/dashboard/settings/buffet`, {
    waitUntil: 'networkidle2',
    timeout: 120_000,
  });
  await new Promise((r) => setTimeout(r, 1500));
  const tabs = await page.$$('button, a, [role="tab"]');
  for (const t of tabs) {
    const text = (await page.evaluate((el) => el.textContent || '', t)).trim();
    if (text === '时段') {
      await t.click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: join(UI, 'buffet-slots.png'), type: 'png' });
      console.log('✓ buffet-slots.png');
    }
  }
  for (const t of await page.$$('button, a, [role="tab"]')) {
    const text = (await page.evaluate((el) => el.textContent || '', t)).trim();
    if (text === '价目表') {
      await t.click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: join(UI, 'buffet-prices-mobile.png'), type: 'png' });
      console.log('✓ buffet-prices-mobile.png');
    }
  }

  // Staff board + open-table flow
  await page.deleteCookie(...(await page.cookies()));
  await page.setCookie(...loadCookies('staff'));
  await shot(page, '/dashboard/waiter', '01-board-idle.png');

  // Open first 开台 button if present
  await page.goto(`${BASE}/dashboard/waiter`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 2000));
  const openBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find((b) => (b.textContent || '').includes('开台')) || null;
  });
  if (openBtn && openBtn.asElement()) {
    await openBtn.asElement().click();
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: join(FLOW, '02-open-dialog.png'), type: 'png' });
    console.log('✓ 02-open-dialog.png');

    // bump adult +
    const plus = await page.evaluateHandle(() => {
      const labels = [...document.querySelectorAll('label, div, span')];
      const adult = labels.find((el) => (el.textContent || '').trim() === '成人');
      if (!adult) return null;
      const row = adult.closest('div');
      if (!row) return null;
      const buttons = [...row.querySelectorAll('button')];
      return buttons[buttons.length - 1] || null;
    });
    if (plus && plus.asElement()) {
      await plus.asElement().click();
      await plus.asElement().click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: join(FLOW, '03-open-adult.png'), type: 'png' });
      console.log('✓ 03-open-adult.png');
    }

    // confirm open
    const confirm = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find((b) => (b.textContent || '').includes('确认开台')) || null;
    });
    if (confirm && confirm.asElement()) {
      await confirm.asElement().click();
      await new Promise((r) => setTimeout(r, 2000));
      await page.screenshot({ path: join(FLOW, '04-board-open.png'), type: 'png' });
      console.log('✓ 04-board-open.png');
    }
  } else {
    console.warn('no 开台 button — keeping previous board shots');
  }

  // Guest demo menu (sharp, no privacy blur) — crop demo chrome later if needed
  await page.deleteCookie(...(await page.cookies()));
  await shot(page, '/demo/menu', join(FLOW, '10-menu-home.png'));
  // Switch to drinks tab
  await page.goto(`${BASE}/demo/menu`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 1500));
  const drinkTab = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('button, a, [role="tab"]')];
    return els.find((el) => (el.textContent || '').includes('饮品')) || null;
  });
  if (drinkTab && drinkTab.asElement()) {
    await drinkTab.asElement().click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: join(FLOW, '11-menu-drinks.png'), type: 'png' });
    console.log('✓ 11-menu-drinks.png');

    // Add first item
    const add = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return (
        buttons.find((b) => {
          const t = (b.textContent || '').trim();
          return t === '+' || t === '＋' || b.getAttribute('aria-label')?.includes('加');
        }) || null
      );
    });
    if (add && add.asElement()) {
      await add.asElement().click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: join(FLOW, '12-menu-added.png'), type: 'png' });
      console.log('✓ 12-menu-added.png');
    } else {
      // click near first + circle
      await page.mouse.click(W * 0.88, H * 0.35);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: join(FLOW, '12-menu-added.png'), type: 'png' });
      console.log('✓ 12-menu-added.png (fallback click)');
    }
  }

  await browser.close();
  console.log('Done — clean captures written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
