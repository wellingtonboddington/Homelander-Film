import * as THREE from 'three';
import { canvas, fbm, fbmTile, rng, TAU, clamp, lerp } from './util.js';

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());

function tex(c, opts = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

export const glowTex = () => once('glow', () => {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.15, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(c);
});

export const streakTex = () => once('streak', () => {
  const [c, g] = canvas(64, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const h = g.createLinearGradient(0, 0, 64, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = h; g.fillRect(0, 0, 64, 256);
  return tex(c);
});

// grayscale cloud map, tileable horizontally (equirect-ish)
export const cloudTex = () => once('cloud', () => {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 8, ny = (y / H) * 4;
      const w = fbmTile(nx + fbmTile(nx, ny + 7, 8, 3) * 1.6, ny, 8, 5);
      let v = clamp((w - 0.28) * 2.1);
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = tex(c, { linear: true, repeat: true });
  return t;
});

// spiral swirl for portal vortex (rgba, alpha shaped)
export const swirlTex = () => once('swirl', () => {
  const S = 512;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x / S) * 2 - 1, dy = (y / S) * 2 - 1;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const i = (y * S + x) * 4;
      if (r >= 1) { img.data[i + 3] = 0; continue; }
      const sa = a + Math.log(r + 0.04) * 2.6;
      const n = fbm(Math.cos(sa) * (r * 3.2 + 1) + 5, Math.sin(sa) * (r * 3.2 + 1) + 9, 5);
      const arms = 0.5 + 0.5 * Math.sin(sa * 3 + n * 4);
      const dens = clamp((n * 1.25 + arms * 0.55 - 0.35) * 1.6);
      const edge = Math.pow(1 - r, 0.55);
      const al = clamp(dens * edge * 1.15);
      const core = Math.pow(clamp(1 - r * 1.6), 2);
      const lum = 0.22 + 0.55 * (1 - r) + core * 0.9 + n * 0.25;
      img.data[i] = clamp(lum * 0.55 + core * 0.6) * 255;
      img.data[i + 1] = clamp(lum * 0.85 + core * 0.4) * 255;
      img.data[i + 2] = clamp(lum * 1.0 + core * 0.2) * 255;
      img.data[i + 3] = al * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return tex(c);
});

// window textures (base + emissive). 8 cols x 16 rows
export function windowTextures(seed = 3, lit = 0.42, warm = 0.7) {
  return once('win' + seed + lit + warm, () => {
    const cols = 8, rows = 16, cw = 16, ch = 16;
    const W = cols * cw, H = rows * ch;
    const [c1, g1] = canvas(W, H);
    const [c2, g2] = canvas(W, H);
    g1.fillStyle = '#b9bcc2'; g1.fillRect(0, 0, W, H);
    g2.fillStyle = '#000'; g2.fillRect(0, 0, W, H);
    const r = rng(seed);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + 3, y = j * ch + 4;
      g1.fillStyle = '#4c5460'; g1.fillRect(x, y, cw - 6, ch - 8);
      if (r() < lit) {
        const w = r() < warm;
        const k = 0.55 + r() * 0.45;
        g2.fillStyle = w ? `rgb(${255 * k | 0},${200 * k | 0},${120 * k | 0})` : `rgb(${170 * k | 0},${215 * k | 0},${255 * k | 0})`;
        g2.fillRect(x, y, cw - 6, ch - 8);
        g1.fillStyle = '#9aa2ae'; g1.fillRect(x, y, cw - 6, ch - 8);
      }
    }
    const a = tex(c1, { repeat: true }), b = tex(c2, { repeat: true });
    a.magFilter = b.magFilter = THREE.NearestFilter;
    return { map: a, emi: b };
  });
}

export const roadTex = () => once('road', () => {
  const [c, g] = canvas(256, 512);
  g.fillStyle = '#1b1c20'; g.fillRect(0, 0, 256, 512);
  const r = rng(9);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 90},${r() < 0.5 ? 0 : 90},${r() < 0.5 ? 0 : 90},0.05)`; g.fillRect(r() * 256, r() * 512, 2, 2); }
  g.fillStyle = '#c9a73a'; g.fillRect(124, 0, 3, 512); g.fillRect(130, 0, 3, 512);
  g.fillStyle = '#9a9a9a';
  for (let k = 0; k < 4; k++) { g.fillRect(60, k * 128 + 20, 3, 60); g.fillRect(192, k * 128 + 20, 3, 60); }
  g.fillStyle = '#7d7f84'; g.fillRect(0, 0, 8, 512); g.fillRect(248, 0, 8, 512);
  const t = tex(c, { repeat: true });
  return t;
});

export const asphaltTex = () => once('asph', () => {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, 128, 128);
  const r = rng(5);
  for (let i = 0; i < 1500; i++) { const v = 30 + r() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(r() * 128, r() * 128, 2, 2); }
  return tex(c, { repeat: true });
});

export const concreteTex = () => once('conc', () => {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#8d8f93'; g.fillRect(0, 0, 128, 128);
  const r = rng(11);
  for (let i = 0; i < 1800; i++) { const v = 100 + r() * 90 | 0; g.fillStyle = `rgba(${v},${v},${v},0.3)`; g.fillRect(r() * 128, r() * 128, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(0, 0, 128, 128);
  return tex(c, { repeat: true });
});

export function textCanvasTex(w, h, draw, opts) {
  const [c, g] = canvas(w, h);
  draw(g, w, h);
  return tex(c, opts);
}

// emblem textures
export const eagleTex = () => once('eagle', () => {
  const [c, g] = canvas(128, 128);
  g.translate(64, 64);
  g.fillStyle = '#e8c04a'; g.strokeStyle = '#8a6a1a'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -42); g.lineTo(7, -30); g.lineTo(52, -44); g.lineTo(40, -20); g.lineTo(58, -8); g.lineTo(34, -2); g.lineTo(44, 18);
  g.lineTo(14, 8); g.lineTo(8, 40); g.lineTo(0, 30); g.lineTo(-8, 40); g.lineTo(-14, 8); g.lineTo(-44, 18); g.lineTo(-34, -2);
  g.lineTo(-58, -8); g.lineTo(-40, -20); g.lineTo(-52, -44); g.lineTo(-7, -30); g.closePath();
  g.fill(); g.stroke();
  return tex(c);
});
export const starTex = (fill = '#f3d36b', stroke = '#b88a1a') => once('star' + fill, () => {
  const [c, g] = canvas(128, 128);
  g.translate(64, 66);
  g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 56; const a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill(); g.stroke();
  return tex(c);
});
export const podTex = () => once('pod', () => {
  const [c, g] = canvas(256, 128);
  g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, 256, 128);
  g.fillStyle = '#c23a1a'; g.font = 'bold 74px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('2I:4', 128, 64);
  return tex(c);
});
export const bannerTex = () => once('ban', () => {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#0a0f14'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#6fd6ff'; g.lineWidth = 6;
  g.beginPath(); g.arc(64, 100, 34, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(64, 40); g.lineTo(64, 170); g.moveTo(20, 100); g.lineTo(108, 100); g.stroke();
  g.fillStyle = '#6fd6ff'; g.fillRect(24, 200, 80, 6); g.fillRect(40, 214, 48, 6);
  return tex(c);
});
