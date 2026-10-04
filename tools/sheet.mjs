// usage: node tools/sheet.mjs out.png cols img1 img2 ...
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [out, colsS, ...imgs] = process.argv.slice(2);
const cols = +colsS || 2;
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},640px);gap:4px">` + imgs.map((f) => `<div style="position:relative"><img src="file://${process.cwd()}/${f}" width="640"><span style="position:absolute;left:6px;top:4px;color:#ff0;font:bold 16px monospace;text-shadow:0 0 3px #000">${f.split('/').pop()}</span></div>`).join('') + '</body></html>';
fs.writeFileSync('/tmp/sheet.html', html);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: cols * 644, height: 700 } });
await p.goto('file:///tmp/sheet.html'); await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
