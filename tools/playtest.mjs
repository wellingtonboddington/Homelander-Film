import { chromium } from 'playwright-core';
const times = (process.env.TIMES || '2,45,100,190,262,330,380,425,500,560,596').split(',').map(Number);
const dwell = +(process.env.DWELL || 4000);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 402 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('PAGEERROR ' + (e.stack || e.message).slice(0, 700)));
await page.goto('file://' + process.cwd() + '/index.html?q=saver');
await page.waitForFunction(() => document.getElementById('play') && !document.getElementById('play').disabled, null, { timeout: 120000 });
await page.click('#play');
for (const t of times) {
  await page.evaluate((t) => { const f = window.__film; f.seek(t); f.dirty(); if (!f.playing) f.play(); }, t);
  await page.waitForTimeout(dwell);
  const st = await page.evaluate(() => { const f = window.__film; return { T: +f.T.toFixed(2), ctx: f.audio && f.audio.ctx && f.audio.ctx.state, scale: +f.scale.toFixed(2), calls: f.renderer.info.render.calls }; });
  console.log('seek', t, '->', JSON.stringify(st));
}
console.log('errors:', errs.length); errs.slice(0, 12).forEach((e) => console.log(' ', e));
await browser.close();
