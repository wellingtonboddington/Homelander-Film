import * as THREE from 'three';
import { clamp, lerp, smooth, rng, V, orient, TAU, hash } from './util.js';
import { glowSprite } from './fx.js';
import { windowTextures, podTex, eagleTex, starTex, bannerTex } from './textures.js';

const geoCache = {};
const G = (key, fn) => geoCache[key] || (geoCache[key] = fn());
export const M = {
  std: (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.08, ...o }),
  lam: (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o }),
  emi: (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o }),
};
const mesh = (g, m, p) => { const o = new THREE.Mesh(g, m); if (p) o.position.set(...p); return o; };
const box = (w, h, d, m, p) => mesh(G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), m, p);
const sph = (r, m, p, sx = 1, sy = 1, sz = 1, seg = 10) => { const o = mesh(G(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0))), m, p); o.scale.set(sx, sy, sz); return o; };
const cyl = (r0, r1, h, m, p, seg = 8) => mesh(G(`c${r0},${r1},${h},${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg)), m, p);
const cap = (r, l, m, p) => mesh(G(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, l), 3, 8)), m, p);
export { box, sph, cyl, cap, mesh };

const blobGeo = () => G('blob', () => new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2));
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false });
export function blob(r) { const b = new THREE.Mesh(blobGeo(), blobMat); b.scale.setScalar(r); b.position.y = 0.03; b.renderOrder = 1; return b; }

export { Human, POSE0 } from './model/human.js';
export { P } from './model/poses.js';
export { CHAR } from './model/chars.js';

/* =========================================================
   COMBINE & CREATURES
========================================================= */
export { Strider, Gunship, Dropship, makeHeadcrab, animHeadcrab } from './model/creatures.js';

export function makePod(open = false) {
  const g = new THREE.Group();
  const orange = M.std(0xd9701a, { metalness: 0.5, roughness: 0.4 }), dark = M.std(0x2a2118, { metalness: 0.6, roughness: 0.5 });
  const core = sph(1, orange, [0, 0, 0], 1, 1.35, 1, 12); g.add(core);
  for (let i = 0; i < 3; i++) { const r = sph(1.02, dark, [0, -0.5 + i * 0.5, 0], 1, 0.08, 1, 12); g.add(r); }
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: podTex(), transparent: true }));
  lab.position.set(0, 0.7, 0.9); lab.rotation.x = -0.35; g.add(lab);
  g.userData.glow = glowSprite(0xff8a30, 6, 0.8); g.userData.glow.position.set(0, -2, 0); g.add(g.userData.glow);
  return g;
}

export function makeGlowStreak(len = 30, color = 0xff9a40, w = 1.2) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(w, len, 8, 1, true).translate(0, len / 2, 0), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.renderOrder = 4;
  return m;
}

/* =========================================================
   MILITARY
========================================================= */
export { makeJet, makeChinook, makeTank } from './model/vehicles.js';

export function makeCar(c = 0x8a2a2a) {
  const g = new THREE.Group();
  g.add(box(1.9, 0.7, 4.4, M.std(c, { metalness: 0.4 }), [0, 0.65, 0]));
  g.add(box(1.7, 0.6, 2.2, M.std(0x222a30, { metalness: 0.6, roughness: 0.2 }), [0, 1.2, -0.2]));
  for (const sx of [-1, 1]) for (const z of [-1.4, 1.4]) { const w = cyl(0.38, 0.38, 0.3, M.std(0x111111), [sx * 0.95, 0.38, z], 8); w.rotation.z = Math.PI / 2; g.add(w); }
  return g;
}

/* =========================================================
   CITY
========================================================= */
export function buildCityGeometry(opts) {
  const { seed = 1, blocks, lit = 0.4, warm = 0.7, tint = 0x8a8e96, tex } = opts;
  const r = rng(seed);
  const pos = [], nor = [], uv = [], colr = [], idx = [];
  const WIN_W = 3.2, FLOOR_H = 3.8;
  let vi = 0;
  const quad = (p0, p1, p2, p3, n, u0, v0, u1, v1, c) => {
    pos.push(...p0, ...p1, ...p2, ...p3);
    for (let i = 0; i < 4; i++) { nor.push(...n); colr.push(c[0], c[1], c[2]); }
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  };
  const col = new THREE.Color();
  const addBuilding = (x, z, w, d, h, shade = 1) => {
    col.set(tint).multiplyScalar(shade * (0.7 + r() * 0.5));
    const c = [col.r, col.g, col.b];
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    const uw = w / WIN_W / 8, ud = d / WIN_W / 8, vh = h / FLOOR_H / 16;
    const ou = r(), ov = Math.floor(r() * 16) / 16;
    quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], ou, ov, ou + uw, ov + vh, c);
    quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], ou, ov, ou + uw, ov + vh, c);
    quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], ou, ov, ou + ud, ov + vh, c);
    quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], ou, ov, ou + ud, ov + vh, c);
    quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], 0.012, 0.004, 0.03, 0.02, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6]);
  };
  blocks.forEach((b) => addBuilding(b.x, b.z, b.w, b.d, b.h, b.shade ?? 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  g.setIndex(idx);
  const wt = windowTextures(seed, lit, warm);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: wt.map, emissiveMap: wt.emi, emissive: 0xffffff, emissiveIntensity: 1.0 });
  const m = new THREE.Mesh(g, mat);
  m.matrixAutoUpdate = true;
  return m;
}

// single destructible building (own mesh) with window texture
export function makeBuilding(w, d, h, tint = 0x8a8e96, seed = 2) {
  const mesh1 = buildCityGeometry({ seed, blocks: [{ x: 0, z: 0, w, d, h }], tint, lit: 0.5 });
  return mesh1;
}

export function makeVoughtTower() {
  const g = new THREE.Group();
  const glass = M.std(0x1a2c3d, { metalness: 0.8, roughness: 0.15 });
  const wt = windowTextures(8, 0.75, 0.55);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a5e72, map: wt.map, emissiveMap: wt.emi, emissive: 0xffffff, emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.35 });
  const mk = (w, d, h, y, uvr = 1) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uvs = geo.attributes.uv; const arr = uvs.array;
    // scale uv so windows tile reasonably
    for (let i = 0; i < arr.length; i += 2) { arr[i] *= (w / 3.2 / 8) * uvr; arr[i + 1] *= h / 3.8 / 16; }
    const m = new THREE.Mesh(geo, mat); m.position.y = y + h / 2; return m;
  };
  g.add(mk(46, 46, 190, 0));
  g.add(mk(38, 38, 90, 190));
  g.add(mk(26, 26, 70, 280));
  g.add(mk(14, 14, 30, 350));
  const spire = cyl(0.8, 1.6, 40, M.std(0x888888, { metalness: 0.9 }), [0, 385, 0]); g.add(spire);
  g.add(sph(1.5, M.emi(0xff3a3a), [0, 405, 0]));
  // Vought V sign (glowing)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 9), new THREE.MeshBasicMaterial({ map: voughtTex(), transparent: true }));
  sign.position.set(0, 330, 13.2); g.add(sign);
  const sign2 = sign.clone(); sign2.position.set(0, 330, -13.2); sign2.rotation.y = Math.PI; g.add(sign2);
  const sign3 = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), new THREE.MeshBasicMaterial({ map: voughtTex(), transparent: true }));
  sign3.position.set(0, 120, 23.2); g.add(sign3);
  // helipad on roof of the 190 block step
  const pad = cyl(11, 11, 0.6, M.std(0x2a2e33), [0, 190.3, 0], 20); g.add(pad);
  const hl = new THREE.Mesh(new THREE.RingGeometry(8.5, 9.5, 24).rotateX(-Math.PI / 2), M.emi(0xffd24a)); hl.position.set(0, 190.8, 0); g.add(hl);
  return g;
}
import { textCanvasTex } from './textures.js';
let _vt;
function voughtTex() {
  return _vt || (_vt = textCanvasTex(512, 180, (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h);
    g.fillStyle = '#e8f0ff'; g.font = '900 130px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#7fb6ff'; g.shadowBlur = 22; g.fillText('VOUGHT', w / 2, h / 2 + 6);
  }));
}
export { voughtTex };

export function makeStratosphere() {
  const g = new THREE.Group();
  const st = M.std(0xb8bdc4, { metalness: 0.5, roughness: 0.4 });
  g.add(cyl(2.6, 4.2, 80, st, [0, 40, 0], 12));
  g.add(cyl(11, 4, 5, st, [0, 82, 0], 14));
  g.add(cyl(11.5, 11.5, 6, M.std(0x5d6b79, { metalness: 0.7, roughness: 0.2 }), [0, 87, 0], 14));
  g.add(cyl(8, 11, 4, st, [0, 92, 0], 14));
  g.add(cyl(0.3, 0.8, 38, st, [0, 112, 0], 6));
  const beacon = glowSprite(0xff4040, 6, 1); beacon.position.set(0, 131, 0); g.add(beacon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11.6, 0.25, 4, 24).rotateX(Math.PI / 2), M.emi(0xffd89a)); ring.position.set(0, 87, 0); g.add(ring);
  return g;
}

export function makeBanner() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 16), new THREE.MeshBasicMaterial({ map: bannerTex(), side: THREE.DoubleSide }));
  return m;
}
