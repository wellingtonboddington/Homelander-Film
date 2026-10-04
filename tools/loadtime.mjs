import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 640, height: 268 } });
const t0 = Date.now();
await page.goto('file://' + process.cwd() + '/index.html?debug=1');
await page.waitForFunction(() => window.__film && window.__film.shots.length > 0, null, { timeout: 180000 });
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's (software GL, includes headless Chromium startup)');
await browser.close();
