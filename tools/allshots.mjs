import { chromium } from 'playwright-core';
import fs from 'node:fs';
const out = 'shots/all'; fs.mkdirSync(out, { recursive: true });
const frac = +(process.env.FRAC || 0.55);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 536 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 500)));
await page.goto('file://' + process.cwd() + '/index.html?debug=1&nohud=1&q=balanced');
await page.waitForFunction(() => window.__film && window.__film.shots.length > 0, null, { timeout: 120000 });
await page.waitForTimeout(500);
const shots = await page.evaluate(() => window.__film.shots.map((s) => [s.t0, s.t1, s.world]));
const from = +(process.env.FROM || 0), to = +(process.env.TO || 1e9);
const rows = [];
for (let i = 0; i < shots.length; i++) {
  const [t0, t1, w] = shots[i]; if (t0 < from || t0 >= to) continue;
  const t = +(t0 + (t1 - t0) * frac).toFixed(2);
  const info = await page.evaluate((t) => { const f = window.__film; f.T = t; f._renderedSub = null; f.frame(t); f.frame(t); const r = f.renderer.info.render; return { calls: r.calls, tris: r.triangles }; }, t);
  const el = await page.$('#stage'); const name = `${out}/s${String(i).padStart(3, '0')}_${t}.png`;
  await el.screenshot({ path: name });
  rows.push(`${String(i).padStart(3)} t=${t} ${w.padEnd(7)} calls=${info.calls} tris=${(info.tris / 1000).toFixed(0)}k`);
}
console.log(rows.join('\n'));
await browser.close();
