import { build } from 'esbuild';
import fs from 'node:fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = fs.readFileSync('src/template.html', 'utf8').replace('/*__SCRIPT__*/', () => js);
fs.writeFileSync('index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
