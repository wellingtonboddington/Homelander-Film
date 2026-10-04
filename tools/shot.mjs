import { chromium } from 'playwright-core';
import fs from 'node:fs';
const times = process.argv.slice(2).map(Number);
const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 536 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
await page.goto('file://' + process.cwd() + '/index.html?debug=1&nohud=1&q=balanced');
await page.waitForFunction(() => window.__film && window.__film.shots.length > 0, null, { timeout: 120000 });
await page.waitForTimeout(500);
const CAM = process.env.CAM ? process.env.CAM.split(',').map(Number) : null;
for (const t of times) {
  await page.evaluate((c) => { window.__camOverride = c; }, CAM);
  await page.evaluate((t) => { const f = window.__film; f.T = t; f.audio && f.audio.reset && f.audio.reset(t); f._renderedSub = null; f.frame(t); }, t);
  await page.waitForTimeout(120);
  await page.evaluate((t) => window.__film.frame(t), t);
  const el = await page.$('#stage');
  await el.screenshot({ path: `${out}/t${String(t).padStart(3, '0')}.png` });
  console.log('shot', t);
}
await browser.close();
