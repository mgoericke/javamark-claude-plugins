import fs from 'node:fs';
import path from 'node:path';
import { importDep } from './deps.mjs';

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

export const slugOf = (route) => {
  const s = route.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return s === '' ? 'home' : s;
};

// runs in the page: top of main (or first h1) and visible controls above it
function measure() {
  const el = document.querySelector('main') ?? document.querySelector('h1');
  if (!el) return { top: null, controls: 0 };
  const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
  let controls = 0;
  for (const c of document.querySelectorAll('a, button, select, input')) {
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (c.type === 'hidden') continue;
    if (r.top + window.scrollY < top) controls += 1;
  }
  return { top, controls };
}

export async function walkRoutes(baseUrl, routes, outDir) {
  const { chromium } = await importDep('playwright');
  fs.mkdirSync(outDir, { recursive: true });
  const base = baseUrl.replace(/\/$/, '');
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ...(vp.name === 'mobile' ? { hasTouch: true } : {}),
      });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          const consoleErrors = [];
          let bytes = 0;
          const pending = [];
          page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
          page.on('pageerror', (e) => consoleErrors.push(String(e.message ?? e)));
          page.on('response', (r) => {
            pending.push(r.body().then((b) => { bytes += b.length; }, () => {
              bytes += Number(r.headers()['content-length'] ?? 0) || 0;
            }));
          });
          let status = 0;
          let finalUrl = base + route;
          try {
            const res = await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
            status = res?.status() ?? 0;
            await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
          } catch (e) {
            consoleErrors.push(`navigation failed: ${e.message.split('\n')[0]}`);
          }
          await Promise.allSettled(pending);
          finalUrl = page.url() && page.url() !== 'about:blank' ? page.url() : finalUrl;
          const pathOf = (u) => { try { return new URL(u, base).pathname; } catch { return u; } };
          const redirected = status !== 0 && pathOf(finalUrl) !== pathOf(route);
          let horizontalScroll = false;
          let mainContentTop = null;
          let controlsAbove = null; // both measured on the mobile viewport only
          try {
            horizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            if (vp.name === 'mobile') {
              const m = await page.evaluate(measure);
              mainContentTop = m.top;
              controlsAbove = m.controls;
            }
          } catch { /* page did not load */ }
          const screenshot = `${slugOf(route)}-${vp.name}.png`;
          await page.screenshot({ fullPage: true, path: path.join(outDir, screenshot) }).catch(() => {});
          await page.close();
          results.push({ route, viewport: vp.name, status, finalUrl, redirected, consoleErrors, horizontalScroll, mainContentTop, controlsAbove, bytes, screenshot });
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  return results;
}
