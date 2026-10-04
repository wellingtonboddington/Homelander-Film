import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 640, height: 268 } });
await page.addInitScript(() => { const o = AudioParam.prototype.setTargetAtTime; window.__bad = []; AudioParam.prototype.setTargetAtTime = function (v, t, c) { if (!isFinite(v) || !isFinite(t) || !isFinite(c)) window.__bad.push([v, t, c, window.__film && window.__film.T, new Error().stack.split('\n')[2]]); return o.call(this, isFinite(v) ? v : 0, isFinite(t) ? t : 0, isFinite(c) ? c : 0.1); }; });
await page.goto('file://' + process.cwd() + '/index.html?q=saver');
await page.waitForFunction(() => document.getElementById('play') && !document.getElementById('play').disabled, null, { timeout: 120000 });
await page.click('#play'); await page.waitForTimeout(3000);
console.log(JSON.stringify(await page.evaluate(() => window.__bad.slice(0, 3))));
await browser.close();
