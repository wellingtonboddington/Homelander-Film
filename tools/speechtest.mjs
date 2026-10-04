// Simulates a speech engine (latency + realistic durations) and checks that no line is ever cut off or overlapped.
import { chromium } from 'playwright-core';
const from = +(process.env.FROM || 40), to = +(process.env.TO || 140);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 480, height: 200 } });
await page.addInitScript(() => {
  window.__ev = []; const SPEED = +(new URLSearchParams(location.search).get('wps') || 2.2);
  class U { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; } }
  window.SpeechSynthesisUtterance = U;
  let active = null, queue = [], timers = [];
  const run = () => { if (active || !queue.length) return; const u = queue.shift(); active = u; const w = u.text.split(/\s+/).filter(Boolean).length; const dur = (w / (SPEED * u.rate) + 0.2) * 1000;
    timers.push(setTimeout(() => { __ev.push(['start', u.text, performance.now()]); u.onstart && u.onstart(); timers.push(setTimeout(() => { __ev.push(['end', u.text, performance.now()]); active = null; u.onend && u.onend(); run(); }, dur)); }, 220)); };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: { speak(u) { queue.push(u); __ev.push(['speak', u.text, performance.now(), u.rate.toFixed(2)]); run(); }, cancel() { if (active || queue.length) __ev.push(['CANCEL', active && active.text, performance.now()]); timers.forEach(clearTimeout); timers = []; active = null; queue = []; }, pause() {}, resume() {}, getVoices() { return [{ name: "Mock David", lang: "en-US" }, { name: "Mock Zira", lang: "en-US" }]; }, addEventListener() {} } });
});
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('file://' + process.cwd() + '/index.html?q=saver&wps=' + (process.env.WPS || 2.2));
await page.waitForFunction(() => document.getElementById('play') && !document.getElementById('play').disabled, null, { timeout: 120000 });
await page.click('#play');
await page.evaluate(([f]) => { const F = window.__film; F.seek(f); F.dirty(); }, [from]);
// run faster than real time by cheating the clock: step the film manually
const r = await page.evaluate(async ([from, to]) => {
  const F = window.__film; F.pause(); F.speech.reset(from); F.T = from; let T = from; let maxHold = 0, holdTime = 0; const t0 = performance.now(); let simNow = 0;

  const dt = 1 / 30; let wall = 0;
  while (T < to && wall < 400) {
    const sc = F.speech.timeScale(F.T, dt); if (sc < 1) holdTime += dt; maxHold = Math.max(maxHold, holdTime); if (sc >= 1) holdTime = 0;
    F.T += dt * sc; F.speech.update(F.T, true); T = F.T; wall += dt;
    await new Promise((r) => setTimeout(r, 33));
  }
  F.playing = false;
  return { T: +F.T.toFixed(1), wall: +wall.toFixed(1), maxHold: +maxHold.toFixed(2) };
}, [from, to]);
const ev = await page.evaluate(() => window.__ev);
let ok = true, spoken = 0, ended = 0, cancels = 0, overlap = 0, lastEnd = 0, open = null;
for (const e of ev) { if (e[0] === 'start') { if (open) overlap++; open = e[1]; spoken++; } if (e[0] === 'end') { ended++; open = null; } if (e[0] === 'CANCEL' && e[1]) cancels++; }
if (process.env.LOG) ev.forEach((e) => console.log(e[0].padEnd(6), (e[2] | 0), String(e[1]).slice(0, 50), e[3] || ''));
console.log(JSON.stringify(r), { speakCalls: ev.filter((e) => e[0] === 'speak').length, started: spoken, ended, cutOff: cancels, overlapped: overlap });
await browser.close();
