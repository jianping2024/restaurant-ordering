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

function jarHasCookie(jarName) {
  try {
    const jar = JSON.parse(readFileSync(`/tmp/mesa-uat/${jarName}.json`, 'utf8'));
    const raw = jar.cookie || "";
    return raw.trim().length > 0;
  } catch {
    return false;
  }
}

async function ensureZh(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem("mesa-ui-lang", "zh");
      document.cookie = "mesa-ui-lang=zh; path=/; max-age=31536000";
    } catch {
      // ignore
    }
  });
}

async function hideDemoChrome(page) {
  // Only strip the demo hub chrome strip — not the whole menu tree.
  await page.evaluate(() => {
    const markers = [
      "演示模式",
      "Modo demo",
      "店主登录",
      "Login do dono",
      "返回演示",
      "Voltar ao hub",
    ];
    const roots = new Set();
    for (const el of Array.from(
      document.querySelectorAll("div, section, header, aside, nav"),
    )) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!markers.some((m) => t.includes(m))) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height > 220 || rect.top > 80) continue;
      roots.add(el);
    }
    for (const el of roots) el.remove();
    for (const b of Array.from(document.querySelectorAll("button"))) {
      const t = (b.textContent || "").trim();
      if (/Começar a pedir|开始点餐|Iniciar pedido/.test(t)) {
        b.closest("div[class],section,dialog,[role=dialog]")?.remove();
      }
    }
  });
}

async function shot(page, path, file) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  // Initial render on dev can be slow; too short wait can produce "white screenshots".
  await new Promise((r) => setTimeout(r, 5200));
  const dest = file.startsWith('/') ? file : join(FLOW, file);
  await page.screenshot({ path: dest, type: 'png' });
  console.log('✓', dest);
}

async function main() {
  // Ensure logins
  const { execFileSync } = await import('node:child_process');
  const repo = join(ROOT, '../..');
  if (!jarHasCookie('owner')) {
    execFileSync('node', ['scripts/mesa-local-uat.mjs', 'login', '--role', 'owner'], {
      cwd: repo,
      stdio: 'inherit',
    });
  } else {
    console.log('✓ reuse /tmp/mesa-uat/owner.json cookie jar');
  }
  if (!jarHasCookie('staff')) {
    execFileSync('node', ['scripts/mesa-local-uat.mjs', 'login', '--role', 'staff'], {
      cwd: repo,
      stdio: 'inherit',
    });
  } else {
    console.log('✓ reuse /tmp/mesa-uat/staff.json cookie jar');
  }

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
  // Same viewport shot also feeds DualDevice phone frame in the ad.
  await page.screenshot({ path: join(UI, 'board-mobile.png'), type: 'png' });
  console.log('✓', join(UI, 'board-mobile.png'));

  // Order history list + detail (S07)
  await shot(page, '/dashboard/orders', '30-order-history.png');
  await page.goto(`${BASE}/dashboard/orders`, {
    waitUntil: 'networkidle2',
    timeout: 120_000,
  });
  await ensureZh(page);
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[role="button"], a, button, div')].filter(
      (el) => /桌\s*\d+|桌\s*0/.test(el.textContent || ''),
    );
    const clickable = cards.find((el) => (el.textContent || '').includes('已结账') || (el.textContent || '').includes('桌'));
    clickable?.click();
  });
  await new Promise((r) => setTimeout(r, 1800));
  await page.screenshot({ path: join(FLOW, '31-order-history-detail.png'), type: 'png' });
  console.log('✓', join(FLOW, '31-order-history-detail.png'));
  await page.keyboard.press('Escape');

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
  await page.goto(`${BASE}/demo/menu`, { waitUntil: 'networkidle2', timeout: 120_000 });
  await ensureZh(page);
  await new Promise((r) => setTimeout(r, 3000));
  await hideDemoChrome(page);
  // Demo menu often shows an onboarding card. Click "start ordering" so we capture real menu list.
  await page.evaluate(() => {
  const candidates = [
      "Começar a pedir",
      "Comecar a pedir",
      "开始点餐",
      "Começar a pedir",
      "Iniciar pedido",
    ];
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) => {
      const t = (b.textContent || "").trim();
      return candidates.some((c) => t.includes(c));
    });
    btn?.click();
  });

  // Non-blocking capture guard: wait a bit and capture even if the selector text isn't matching.
  await new Promise((r) => setTimeout(r, 8000));
  try {
    const sample = await page.evaluate(() => (document.body?.innerText || "").trim().slice(0, 160));
    console.log("menu page text sample:", sample.replace(/\s+/g, " "));
  } catch {
    // ignore
  }
  await page.screenshot({ path: join(FLOW, '10-menu-home.png'), type: 'png' });
  console.log('✓', join(FLOW, '10-menu-home.png'));
  // Drinks tab — stay on the same session after start-ordering when possible.
  await page.evaluate(() => {
    const candidates = ["Começar a pedir", "开始点餐", "Iniciar pedido"];
    const buttons = Array.from(document.querySelectorAll("button"));
    const btn = buttons.find((b) =>
      candidates.some((c) => (b.textContent || "").trim().includes(c)),
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const drinkTab = await page.evaluateHandle(() => {
    const els = [...document.querySelectorAll('button, a, [role="tab"]')];
    return (
      els.find((el) => /饮品|Bebidas|Drinks/i.test(el.textContent || '')) || null
    );
  });
  if (drinkTab && drinkTab.asElement()) {
    await drinkTab.asElement().click();
    await new Promise((r) => setTimeout(r, 1200));
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
      await page.mouse.click(W * 0.88, H * 0.35);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: join(FLOW, '12-menu-added.png'), type: 'png' });
      console.log('✓ 12-menu-added.png (fallback click)');
    }
  } else {
    console.warn('no drinks tab — keep previous drinks shots');
  }

  // Desktop board for DualDevice
  await page.deleteCookie(...(await page.cookies()));
  await page.setCookie(...loadCookies('staff'));
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/dashboard/waiter`, {
    waitUntil: 'networkidle2',
    timeout: 120_000,
  });
  await ensureZh(page);
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: join(UI, 'board-desktop.png'), type: 'png' });
  console.log('✓', join(UI, 'board-desktop.png'));

  await browser.close();
  console.log('Done — clean captures written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
