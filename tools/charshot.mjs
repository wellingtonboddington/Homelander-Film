// usage: node tools/charshot.mjs name:x,y,z:lx,ly,lz:fov ...   (renders test=chars lineup)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 418 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
await page.goto('file://' + process.cwd() + '/index.html?debug=1&nohud=1&test=chars&q=high');
await page.waitForFunction(() => window.__film && window.__film.shots.length > 0, null, { timeout: 180000 });
fs.mkdirSync('shots/c', { recursive: true });
for (const spec of process.argv.slice(2)) {
  const [name, p, l, fov] = spec.split(':'); const cam = [...p.split(',').map(Number), ...l.split(',').map(Number), +fov || 30];
  await page.evaluate((c) => { window.__camOverride = c; const f = window.__film; f.T = 5; f.frame(5); f.frame(5); }, cam);
  await page.waitForTimeout(150);
  await (await page.$('#stage')).screenshot({ path: `shots/c/${name}.png` }); console.log('ok', name);
}
await browser.close();
