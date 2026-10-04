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

/* =========================================================
   HUMANOID
========================================================= */
const POSE_KEYS = ['ry', 'rx', 'rz', 'ryaw', 'sx', 'sy', 'sz', 'hx', 'hy', 'hz', 'lax', 'laz', 'lay', 'le', 'rax', 'raz', 'ray', 're', 'llh', 'llz', 'lk', 'rlh', 'rlz', 'rk'];
export const POSE0 = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));

export class Human {
  constructor(o = {}) {
    this.o = o;
    const s = o.scale || 1;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); this.body.scale.setScalar(s); this.group.add(this.body);
    const sk = M.std(o.skin ?? 0xe3b496, { roughness: 0.85 });
    const suit = M.std(o.suit ?? 0x2a3a66, { roughness: 0.5, metalness: o.metal ?? 0.15 });
    const suit2 = M.std(o.suit2 ?? o.suit ?? 0x222a44, { roughness: 0.55, metalness: o.metal ?? 0.12 });
    const slv = M.std(o.sleeve ?? o.suit2 ?? o.suit ?? 0x2a3a66, { roughness: 0.55 });
    const boots = M.std(o.boots ?? 0x222222, { roughness: 0.6 });
    const gloves = M.std(o.gloves ?? o.skin ?? 0xe3b496, { roughness: 0.7 });
    const hair = M.std(o.hair ?? 0x3a2a1a, { roughness: 0.9 });
    this.mats = { sk, suit, suit2, slv, boots, gloves, hair };
    const bulk = o.bulk || 1, sw = o.shoulder || 1;
    this.root = new THREE.Group(); this.body.add(this.root); this.root.position.y = 0.97;
    this.root.add(box(0.34 * bulk, 0.2, 0.2 * bulk, suit2, [0, 0, 0]));
    this.spine = new THREE.Group(); this.spine.position.y = 0.08; this.root.add(this.spine);
    const chest = box(0.44 * bulk * sw, 0.54, 0.25 * bulk, suit, [0, 0.29, 0]); this.spine.add(chest);
    const chest2 = sph(0.17, suit, [0, 0.46, 0], 1.45 * bulk * sw, 0.7, 0.85); this.spine.add(chest2);
    if (o.belt) this.spine.add(box(0.36 * bulk, 0.06, 0.22 * bulk, M.std(o.belt, { metalness: 0.5 }), [0, 0.04, 0]));
    if (o.emblem) {
      const tx = o.emblem === 'eagle' ? eagleTex() : starTex(o.emblemFill || '#f3d36b');
      const e = new THREE.Mesh(G('emb', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
      e.scale.setScalar(o.emblemSize || 0.24); e.position.set(0, 0.36, 0.127 * bulk); this.spine.add(e);
    }
    if (o.stripe) { for (const sx of [-1, 1]) this.spine.add(box(0.04, 0.54, 0.255 * bulk, M.std(o.stripe), [sx * 0.15 * bulk, 0.29, 0])); }
    if (o.pads) { for (const sx of [-1, 1]) this.spine.add(sph(0.095, M.std(o.pads, { metalness: 0.6, roughness: 0.35 }), [sx * 0.25 * bulk * sw, 0.53, 0], 1.1, 0.8, 1.1)); }
    this.neck = new THREE.Group(); this.neck.position.y = 0.6; this.spine.add(this.neck);
    this.neck.add(cyl(0.05, 0.055, 0.08, sk, [0, 0.03, 0]));
    this.head = new THREE.Group(); this.head.position.y = 0.08; this.neck.add(this.head);
    this._face(o, sk, hair);
    this.sh = {}; this.el = {};
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(side * 0.255 * bulk * sw, 0.52, 0); this.spine.add(sh);
      sh.add(sph(0.065 * bulk, slv, [0, 0, 0]));
      sh.add(cap(0.052 * bulk, 0.2, slv, [0, -0.15, 0]));
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      el.add(sph(0.05 * bulk, slv, [0, 0, 0]));
      el.add(cap(0.047 * bulk, 0.2, o.forearm ? M.std(o.forearm) : slv, [0, -0.14, 0]));
      el.add(sph(0.058, gloves, [0, -0.3, 0.01]));
      this[side > 0 ? 'shL' : 'shR'] = sh; this[side > 0 ? 'elL' : 'elR'] = el;
    }
    for (const side of [1, -1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.1 * bulk, -0.04, 0); this.root.add(hp);
      hp.add(cap(0.075 * bulk, 0.33, suit2, [0, -0.23, 0]));
      const kn = new THREE.Group(); kn.position.y = -0.47; hp.add(kn);
      kn.add(sph(0.065, suit2, [0, 0, 0]));
      kn.add(cap(0.06 * bulk, 0.34, suit2, [0, -0.24, 0]));
      kn.add(box(0.11, 0.11, 0.26, boots, [0, -0.46, 0.05]));
      kn.add(cyl(0.065, 0.07, 0.2, boots, [0, -0.38, 0]));
      this[side > 0 ? 'hpL' : 'hpR'] = hp; this[side > 0 ? 'knL' : 'knR'] = kn;
    }
    if (o.cape) this._cape(o);
    if (o.helmet) this.head.add(sph(0.125, M.std(o.helmet, { metalness: 0.5, roughness: 0.4 }), [0, 0.1, -0.005], 1, 0.75, 1.05));
    this.shadow = blob(0.5 * s); this.group.add(this.shadow);
    this.gun = null;
    if (o.gun) { this.gun = this._gun(); this.elR.add(this.gun); }
    this.pose(POSE0);
    this.face(0.12);
  }
  _face(o, sk, hair) {
    const h = this.head;
    const mask = o.mask != null;
    const hm = mask ? M.std(o.mask, { roughness: 0.4, metalness: 0.2 }) : sk;
    h.add(sph(0.108, hm, [0, 0.1, 0], 1, 1.18, 1.05, 12));
    h.add(sph(0.075, hm, [0, 0.035, 0.035], 1.0, 0.9, 0.95, 8)); // jaw
    this.eyes = [];
    const eyeM = M.emi(mask ? 0xcfe8ff : 0xf4f0ea);
    const pupM = M.emi(0x15110e);
    for (const sx of [-1, 1]) {
      if (!mask) {
        h.add(sph(0.017, eyeM, [sx * 0.04, 0.115, 0.095], 1.2, 0.8, 0.6, 6));
        h.add(sph(0.009, pupM, [sx * 0.04, 0.115, 0.104], 1, 1, 0.6, 5));
        h.add(box(0.05, 0.01, 0.015, o.hair ? M.std(o.hair) : pupM, [sx * 0.04, 0.14, 0.098]));
      } else {
        h.add(box(0.045, 0.012, 0.012, eyeM, [sx * 0.04, 0.115, 0.108]));
      }
      const gl = sph(0.02, M.emi(0xff2200), [sx * 0.04, 0.115, 0.1], 1, 1, 0.5, 6); gl.visible = false; h.add(gl); this.eyes.push(gl);
    }
    h.add(box(0.025, 0.04, 0.03, hm, [0, 0.085, 0.107]));
    this.mouth = new THREE.Mesh(G('mouth', () => new THREE.TorusGeometry(0.026, 0.0045, 4, 10, Math.PI)), M.emi(mask ? 0x111111 : 0x7a2f2f));
    this.mouth.position.set(0, 0.05, 0.103); this.mouth.rotation.z = Math.PI; // smile (arc facing down)
    if (!mask || o.showMouth) h.add(this.mouth);
    const st = o.hairStyle || 'short';
    if (st === 'short' || st === 'side' || st === 'long' || st === 'bob') {
      const cap1 = mesh(G('hcap', () => new THREE.SphereGeometry(0.116, 12, 8, 0, TAU, 0, Math.PI * 0.55)), hair, [0, 0.12, -0.012]);
      cap1.scale.set(1, 1.1, 1.08); h.add(cap1);
      if (st === 'side') { h.add(box(0.14, 0.04, 0.06, hair, [0.01, 0.2, 0.06])); }
      if (st === 'long') { h.add(box(0.2, 0.34, 0.07, hair, [0, -0.03, -0.075])); for (const sx of [-1, 1]) h.add(box(0.03, 0.22, 0.1, hair, [sx * 0.105, 0.02, -0.02])); }
      if (st === 'bob') { h.add(box(0.23, 0.17, 0.08, hair, [0, 0.07, -0.075])); for (const sx of [-1, 1]) h.add(box(0.03, 0.14, 0.12, hair, [sx * 0.108, 0.07, -0.01])); }
    }
    if (st === 'buzz') { const c = mesh(G('hcap2', () => new THREE.SphereGeometry(0.111, 10, 6, 0, TAU, 0, Math.PI * 0.45)), hair, [0, 0.125, -0.008]); c.scale.set(1, 1.1, 1.06); h.add(c); }
    if (o.beard) h.add(box(0.14, 0.08, 0.06, M.std(o.beardColor ?? o.hair ?? 0x2a2a2a), [0, 0.035, 0.07]));
    if (o.glasses) { h.add(box(0.14, 0.03, 0.01, M.emi(0x111111), [0, 0.115, 0.112])); }
    if (o.tiara) h.add(box(0.15, 0.025, 0.02, M.std(0xe8e8f0, { metalness: 0.8, roughness: 0.2 }), [0, 0.21, 0.07]));
    if (o.cowl) { h.add(sph(0.115, M.std(o.cowl), [0, 0.1, -0.012], 1.0, 1.18, 1.05)); }
  }
  _cape(o) {
    const w = 0.62, hgt = o.capeLen || 1.5, sx = 6, sy = 12;
    const geo = new THREE.PlaneGeometry(w, hgt, sx, sy);
    this.capeGeo = geo;
    this.capeBase = geo.attributes.position.array.slice();
    const mat = M.std(o.cape, { side: THREE.DoubleSide, roughness: 0.7 });
    this.capeMesh = new THREE.Mesh(geo, mat);
    this.capeMesh.frustumCulled = false;
    this.spine.add(this.capeMesh);
    this.capeLen = hgt; this.capeW = w; this.capeSX = sx; this.capeSY = sy;
    this.capeFlow = 0; this.capeT = 0;
    if (o.collar) { this.spine.add(box(0.5, 0.05, 0.1, M.std(o.collar, { metalness: 0.7, roughness: 0.3 }), [0, 0.57, -0.1])); }
    this.updateCape(0, 0);
  }
  // flow: 0 hang, 1 streaming back (relative to body), t time
  updateCape(t, flow = 0, wind = 1) {
    if (!this.capeMesh) return;
    const pa = this.capeGeo.attributes.position;
    const n = pa.count, cols = this.capeSX + 1;
    for (let i = 0; i < n; i++) {
      const row = (i / cols) | 0, col = i % cols;
      const v = row / this.capeSY, u = col / this.capeSX - 0.5;
      const L = v * this.capeLen;
      const wave = Math.sin(t * 5.5 + v * 7 + u * 3) * (0.02 + 0.22 * v * v) * wind + Math.sin(t * 11 + v * 12) * 0.03 * v * flow;
      const spread = 1 + v * (0.35 + 0.6 * flow);
      // hang along -Y; with flow lean backwards (-Z)
      const ang = flow * 1.35 * Math.min(1, v * 1.6 + 0.2);
      const x = u * this.capeW * spread + wave * 0.6 * (1 + flow);
      const y = 0.56 - L * Math.cos(flow * 0.35 * (1 + v));
      const z = -0.14 - L * Math.sin(Math.min(ang, 1.5)) * 0.9 - Math.abs(wave) * 0.25 - v * 0.05;
      pa.setXYZ(i, x, y, z);
    }
    pa.needsUpdate = true;
    this.capeGeo.computeVertexNormals();
    this.capeMesh.position.set(0, 0, 0);
  }
  _gun() {
    const g = new THREE.Group();
    g.add(box(0.05, 0.07, 0.5, M.std(0x222222), [0, -0.3, 0.2]));
    g.add(box(0.04, 0.1, 0.06, M.std(0x222222), [0, -0.36, 0.05]));
    g.rotation.x = 0; this.flash = glowSprite(0xffcc66, 0.7, 0); this.flash.position.set(0, -0.3, 0.55); g.add(this.flash);
    return g;
  }
  pose(p) {
    const P = (k) => p[k] || 0;
    this.root.position.y = 0.97 + P('ry');
    this.root.rotation.set(P('rx'), P('ryaw'), P('rz'));
    this.spine.rotation.set(P('sx'), P('sy'), P('sz'));
    this.head.rotation.set(P('hx'), P('hy'), P('hz'));
    this.shL.rotation.set(-P('lax'), P('lay'), P('laz'));
    this.shR.rotation.set(-P('rax'), P('ray'), -P('raz'));
    this.elL.rotation.set(-P('le'), 0, 0);
    this.elR.rotation.set(-P('re'), 0, 0);
    this.hpL.rotation.set(-P('llh'), 0, P('llz'));
    this.hpR.rotation.set(-P('rlh'), 0, -P('rlz'));
    this.knL.rotation.set(P('lk'), 0, 0);
    this.knR.rotation.set(P('rk'), 0, 0);
  }
  place(x, y, z, ry = 0) {
    this.group.position.set(x, y, z); this.group.rotation.y = ry;
    this.shadow.visible = y < 2.5;
    this.shadow.position.y = 0.03 - y; // stays at world ground (y=0)
    return this;
  }
  face(smile = 0.5) { // -1 frown .. 1 smile
    this.mouth.rotation.z = smile >= 0 ? Math.PI : 0;
    this.mouth.scale.set(1, Math.abs(smile) * 1.2 + 0.1, 1);
    this.mouth.position.y = smile >= 0 ? 0.052 : 0.04;
  }
  heat(on) { this.eyes.forEach((e) => (e.visible = on)); }
  look(visible) { this.group.visible = visible; }
}

/* ---- Pose library ---- */
const sin = Math.sin, cos = Math.cos;
export const P = {
  idle: (t, a = 1) => ({ ry: sin(t * 1.6) * 0.004 * a, sx: sin(t * 1.6) * 0.012 * a, lax: 0.04, rax: 0.04, laz: 0.1, raz: 0.1, le: 0.1, re: 0.1, hx: sin(t * 0.7) * 0.02 }),
  stand: (t = 0) => ({ ry: sin(t * 1.6) * 0.004, lax: 0.0, rax: 0.0, laz: 0.07, raz: 0.07, le: 0.08, re: 0.08 }),
  hero: (t = 0) => ({ ry: sin(t * 1.4) * 0.005, sx: -0.04, hx: -0.04, lax: -0.05, rax: -0.05, laz: 0.32, raz: 0.32, le: 0.5, re: 0.5, llz: 0.06, rlz: 0.06 }),
  arms_crossed: (t = 0) => ({ ry: sin(t * 1.4) * 0.004, lax: 0.6, rax: 0.7, laz: -0.5, raz: -0.45, le: 2.1, re: 2.0, lay: 0.2 }),
  walk: (ph, spd = 1) => {
    const a = sin(ph) * 0.65 * spd, b = -a, k1 = Math.max(0, -sin(ph + 0.9)) * 0.9 * spd, k2 = Math.max(0, sin(ph + 0.9)) * 0.9 * spd;
    return { ry: Math.abs(cos(ph)) * 0.035 * spd - 0.02, sy: sin(ph) * 0.12 * spd, sx: 0.05 * spd, llh: a, rlh: b, lk: k1, rk: k2, lax: b * 0.7, rax: a * 0.7, laz: 0.08, raz: 0.08, le: 0.3 + Math.max(0, b) * 0.4, re: 0.3 + Math.max(0, a) * 0.4 };
  },
  run: (ph, spd = 1) => {
    const a = sin(ph) * 1.1, b = -a, k1 = (0.3 + Math.max(0, -sin(ph + 1.1)) * 1.6), k2 = (0.3 + Math.max(0, sin(ph + 1.1)) * 1.6);
    return { ry: -0.05 + Math.abs(cos(ph)) * 0.08, rx: 0.28, sx: 0.12, sy: sin(ph) * 0.2, hx: -0.2, llh: a, rlh: b, lk: k1, rk: k2, lax: b * 0.95, rax: a * 0.95, laz: 0.12, raz: 0.12, le: 1.4, re: 1.4 };
  },
  sprint: (ph) => {
    const a = sin(ph) * 1.4, b = -a;
    return { ry: -0.12, rx: 0.5, sx: 0.12, hx: -0.4, llh: a, rlh: b, lk: 0.4 + Math.max(0, -sin(ph + 1.1)) * 1.9, rk: 0.4 + Math.max(0, sin(ph + 1.1)) * 1.9, lax: b * 1.1, rax: a * 1.1, le: 1.5, re: 1.5, laz: 0.1, raz: 0.1 };
  },
  // Superman-style flying (body horizontal). pitch: 0 = horizontal, 1 = vertical up
  fly: (t, up = 0) => ({ rx: lerp(1.45, 0.05, up), ry: 0, hx: lerp(-0.6, 0, up) * 0.6, lax: lerp(2.9, 0.1, up), rax: lerp(2.9, 0.1, up), laz: 0.08, raz: 0.08, le: 0.05, re: 0.05, llh: -0.05 + sin(t * 3) * 0.05, rlh: -0.05 - sin(t * 3) * 0.05, lk: 0.1, rk: 0.1 }),
  hover: (t) => ({ ry: sin(t * 1.5) * 0.05, rx: 0.05, lax: 0.05, rax: 0.05, laz: 0.35, raz: 0.35, le: 0.45, re: 0.45, llh: 0.1, rlh: -0.05, lk: 0.2, rk: 0.35, hx: -0.05 }),
  aim: (t = 0) => ({ ry: -0.1, sx: 0.05, sy: -0.35, lax: 1.35, rax: 1.45, laz: -0.05, raz: -0.12, le: 0.55, re: 0.6, lay: -0.5, ray: -0.2, llh: 0.15, rlh: -0.25, lk: 0.25, rk: 0.3, hx: 0.0, hy: 0.35 }),
  crouchAim: (t = 0) => ({ ry: -0.4, sx: 0.15, sy: -0.35, lax: 1.3, rax: 1.4, laz: -0.05, raz: -0.12, le: 0.6, re: 0.6, lay: -0.5, ray: -0.2, llh: 1.0, rlh: 0.5, lk: 1.6, rk: 1.5, hy: 0.35 }),
  punch: (u) => { const w = smooth(u < 0.5 ? u / 0.5 : 1 - (u - 0.5) / 0.5); return { rx: 0.1 * w, sy: -0.7 * w + 0.35 * (1 - w), ryaw: -0.2 * w, lax: 0.4, rax: 1.55 * w, raz: 0.2, le: 0.2 + (1 - w) * 0.9, re: 0.15 + (1 - w) * 2.2, llh: 0.35, rlh: -0.45, lk: 0.2, rk: 0.4, hx: -0.05 }; },
  slam: (u) => { const w = smooth(u); return { rx: 0.6 * w, ry: -0.2 * w, lax: 0.4 + 1.8 * (1 - w), rax: 0.4 + 1.8 * (1 - w), le: 0.5, re: 0.5, llh: 0.4 * w, rlh: -0.3 * w, lk: 0.6 * w, rk: 0.2 * w, hx: -0.2 }; },
  raise: (u) => { const w = smooth(u); return { rx: -0.05, lax: 3.0 * w, rax: 3.0 * w, laz: 0.15, raz: 0.15, le: 0.1, re: 0.1, hx: -0.5 * w }; },
  point: (t = 0) => ({ rax: 1.5, raz: 0.05, re: 0.1, lax: 0.1, laz: 0.1, le: 0.3, sy: -0.2, hy: 0.2 }),
  gesture: (t, a = 1) => ({ ry: sin(t * 1.6) * 0.004, hx: sin(t * 2.1) * 0.04, hy: sin(t * 1.3) * 0.08, lax: 0.45 + sin(t * 3.1) * 0.35 * a, rax: 0.35 + sin(t * 2.3 + 1) * 0.3 * a, laz: 0.2, raz: 0.2, le: 1.0 + sin(t * 3.1) * 0.3 * a, re: 0.9 + sin(t * 2.3 + 1) * 0.3 * a }),
  sit: (t = 0, a = 0.5) => ({ ry: -0.45, llh: 1.5, rlh: 1.5, lk: 1.55, rk: 1.55, lax: 0.55 + sin(t * 2.6) * 0.1 * a, rax: 0.55, le: 1.0, re: 1.0, laz: 0.15, raz: 0.15, sx: 0.04, hx: sin(t * 1.9) * 0.03, hy: sin(t * 0.9) * 0.1 }),
  hurt: (u) => { const w = smooth(u); return { rx: -0.35 * w, sx: -0.3 * w, hx: -0.4 * w, lax: -0.7 * w, rax: -0.5 * w, laz: 0.6 * w, raz: 0.5 * w, le: 0.4, re: 0.4, llh: 0.3 * w, rlh: -0.2 * w, lk: 0.3, rk: 0.5 }; },
  die: (u) => { // forward collapse onto knees then flat on back
    const w = smooth(u);
    const down = smooth(clamp((u - 0.3) / 0.7));
    return { ry: -0.97 * 0.9 * down + 0.0, rx: -1.57 * down, sx: -0.1 * w, hx: -0.3 * w, lax: -0.4 * w, rax: -0.2 * w, laz: 0.9 * w, raz: 0.9 * w, le: 0.3 + 0.4 * w, re: 0.3 + 0.4 * w, llh: 0.6 * (1 - down), rlh: -0.1 * (1 - down), lk: 0.9 * (1 - down), rk: 1.4 * (1 - down) };
  },
  dead: () => ({ ry: -0.88, rx: -1.57, hx: -0.1, lax: -0.1, rax: 0.0, laz: 0.4, raz: 0.5, le: 0.2, re: 0.3, llz: 0.15, rlz: 0.1, lk: 0.1, rk: 0.2 }),
  cower: (t) => ({ ry: -0.45, rx: 0.5, sx: 0.5, hx: 0.3, lax: 1.0, rax: 1.0, laz: -0.2, raz: -0.2, le: 2.2, re: 2.2, llh: 1.2, rlh: 1.1, lk: 1.9, rk: 1.8 }),
  zombie: (ph) => ({ ry: -0.03, rx: 0.2, sx: 0.28, hx: 0.3 + sin(ph * 0.5) * 0.08, hz: sin(ph * 0.5) * 0.15, lax: 1.4 + sin(ph) * 0.12, rax: 1.3 - sin(ph) * 0.12, laz: 0.1, raz: 0.15, le: 0.25, re: 0.3, llh: sin(ph) * 0.45, rlh: -sin(ph) * 0.45, lk: Math.max(0, -sin(ph + 1)) * 0.5, rk: Math.max(0, sin(ph + 1)) * 0.5, sy: sin(ph) * 0.12 }),
  kneel: (t = 0) => ({ ry: -0.5, sx: 0.1, hx: 0.2, lax: 0.2, rax: 0.2, laz: 0.2, raz: 0.2, le: 0.6, re: 0.6, llh: 1.5, rlh: 0.1, lk: 1.7, rk: 1.9 }),
  carry: (t = 0) => ({ lax: 1.0, rax: 1.0, laz: -0.2, raz: -0.2, le: 1.1, re: 1.1 }),
  salute: (t = 0) => ({ rax: 1.8, raz: -0.2, re: 2.4, lax: 0.05, laz: 0.08, le: 0.1 }),
  lookup: (t = 0) => ({ hx: -0.55, sx: -0.06, lax: 0.04, rax: 0.04, laz: 0.1, raz: 0.1, le: 0.1, re: 0.1 }),
  blend(a, b, w) { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] || 0, b[k] || 0, w); return o; },
};

/* ---- Character presets ---- */
export const CHAR = {
  homelander: () => new Human({ skin: 0xe8b99a, hair: 0xc9a24a, hairStyle: 'side', suit: 0x233b8a, suit2: 0xdcdce2, sleeve: 0x233b8a, forearm: 0xc41f2a, boots: 0xc41f2a, gloves: 0xdcdce2, emblem: 'eagle', emblemSize: 0.3, pads: 0xd9b44a, cape: 0xb3121c, collar: 0xd9b44a, capeLen: 1.65, bulk: 1.22, shoulder: 1.12, belt: 0xd9b44a, stripe: 0xc41f2a, metal: 0.2 }),
  starlight: () => new Human({ skin: 0xf0c8aa, hair: 0xe8d28a, hairStyle: 'long', suit: 0xf2f0ea, suit2: 0xe5e3dc, sleeve: 0xf2f0ea, boots: 0xe8c36a, gloves: 0xe8c36a, emblem: 'star', emblemSize: 0.24, belt: 0xe8c36a, bulk: 0.85, shoulder: 0.92, scale: 0.94, metal: 0.25 }),
  maeve: () => new Human({ skin: 0xe7bfa2, hair: 0x2a1c14, hairStyle: 'long', suit: 0x1a1d28, suit2: 0x2a2c3a, sleeve: 0x1a1d28, boots: 0x14151c, gloves: 0x8a7a4a, pads: 0xa8914a, belt: 0xa8914a, emblem: 'star', emblemFill: '#c9b36a', emblemSize: 0.2, tiara: true, bulk: 0.92, scale: 0.98 }),
  atrain: () => new Human({ skin: 0x7a4a30, hair: 0x120d0a, hairStyle: 'buzz', suit: 0x1b2a55, suit2: 0x14203f, sleeve: 0x1b2a55, boots: 0xe6e6ea, gloves: 0xe6e6ea, stripe: 0xe6e6ea, belt: 0xe6e6ea, bulk: 0.95, scale: 1.0, beard: true, metal: 0.3 }),
  deep: () => new Human({ skin: 0xe0b698, hair: 0x2a2018, hairStyle: 'short', beard: true, suit: 0x1b7f86, suit2: 0x146066, sleeve: 0x1b7f86, boots: 0x0d3f44, gloves: 0x0d3f44, belt: 0xbfe8e8, stripe: 0xaee8e0, bulk: 1.05, metal: 0.4, emblem: 'star', emblemFill: '#9fe3df', emblemSize: 0.2 }),
  noir: () => new Human({ skin: 0x111111, mask: 0x0c0c0e, suit: 0x0e0e12, suit2: 0x0e0e12, sleeve: 0x0e0e12, boots: 0x08080a, gloves: 0x08080a, hair: null, hairStyle: 'none', bulk: 1.12, shoulder: 1.1, belt: 0x2a2a30, stripe: 0x222228, metal: 0.4 }),
  soldierboy: () => new Human({ skin: 0xe6b898, hair: 0xb89a55, hairStyle: 'buzz', suit: 0x1f3a8c, suit2: 0xe9e9ee, sleeve: 0xb21f2d, boots: 0x7a1a22, gloves: 0xe9e9ee, emblem: 'star', emblemFill: '#f4f4f8', emblemSize: 0.32, stripe: 0xb21f2d, bulk: 1.25, shoulder: 1.1, scale: 1.04, helmet: 0x1f3a8c, belt: 0x6a4a2a }),
  butcher: () => new Human({ skin: 0xdcb094, hair: 0x2a2018, hairStyle: 'buzz', beard: true, beardColor: 0x2a2018, suit: 0x16171b, suit2: 0x2c3140, sleeve: 0x16171b, boots: 0x15120f, gloves: 0x15120f, bulk: 1.12, scale: 1.0 }),
  hughie: () => new Human({ skin: 0xe9c0a3, hair: 0x3a2514, hairStyle: 'short', suit: 0x3d5e74, suit2: 0x3a3f4c, sleeve: 0x3d5e74, boots: 0x2a2220, gloves: 0xe9c0a3, bulk: 0.92, scale: 0.98 }),
  mm: () => new Human({ skin: 0x5a3a28, hair: 0x121212, hairStyle: 'buzz', beard: true, beardColor: 0x151515, suit: 0x23282b, suit2: 0x2a3033, sleeve: 0x23282b, boots: 0x15120f, gloves: 0x15120f, bulk: 1.25, shoulder: 1.1, scale: 1.04 }),
  frenchie: () => new Human({ skin: 0xe0b394, hair: 0x2f2318, hairStyle: 'side', suit: 0x6a4a36, suit2: 0x2b2f3a, sleeve: 0x6a4a36, boots: 0x1a1512, gloves: 0xe0b394, bulk: 0.95, scale: 0.97, beard: true, beardColor: 0x2f2318 }),
  kimiko: () => new Human({ skin: 0xe8c2a4, hair: 0x0e0b0a, hairStyle: 'long', suit: 0x1c1d22, suit2: 0x232630, sleeve: 0x1c1d22, boots: 0x15120f, gloves: 0xe8c2a4, bulk: 0.82, shoulder: 0.9, scale: 0.9 }),
  edgar: () => new Human({ skin: 0xd8ad90, hair: 0xc9c9c9, hairStyle: 'short', suit: 0x15161a, suit2: 0x15161a, sleeve: 0x15161a, boots: 0x0c0c0c, gloves: 0xd8ad90, glasses: true, bulk: 1.0, scale: 1.0 }),
  ashley: () => new Human({ skin: 0xf0c6aa, hair: 0xd9bf78, hairStyle: 'bob', suit: 0xeeeeea, suit2: 0xdcdcd8, sleeve: 0xeeeeea, boots: 0x222222, gloves: 0xf0c6aa, bulk: 0.8, shoulder: 0.9, scale: 0.94 }),
  neuman: () => new Human({ skin: 0xe0b295, hair: 0x181210, hairStyle: 'bob', suit: 0x7a1b2c, suit2: 0x2a2a32, sleeve: 0x7a1b2c, boots: 0x111111, gloves: 0xe0b295, bulk: 0.82, shoulder: 0.9, scale: 0.95 }),
  general: () => new Human({ skin: 0xd3a587, hair: 0x8f8f8f, hairStyle: 'buzz', suit: 0x2a3a2c, suit2: 0x2a3a2c, sleeve: 0x2a3a2c, boots: 0x111111, gloves: 0xd3a587, bulk: 1.1, pads: 0xc9b25a, scale: 1.0 }),
  soldier: (seed = 1) => new Human({ skin: [0xe0b496, 0xb98363, 0x7a4f35][seed % 3], hair: 0x2a2018, hairStyle: 'buzz', suit: 0x4a5238, suit2: 0x3f4632, sleeve: 0x4a5238, boots: 0x1c1a14, gloves: 0x222222, helmet: 0x3f4632, bulk: 1.08, scale: 1.0, gun: true }),
  civilian: (seed = 1) => { const r = rng(seed * 31 + 7); const cs = [0x8a3a3a, 0x3a6a8a, 0x6a8a3a, 0xc9a23a, 0x5a5a6a, 0x8a5a9a]; return new Human({ skin: [0xe0b496, 0xb98363, 0x7a4f35, 0xf0c8aa][(r() * 4) | 0], hair: [0x2a2018, 0x6a4a2a, 0xaaaaaa, 0x111111][(r() * 4) | 0], hairStyle: r() < 0.5 ? 'short' : 'long', suit: cs[(r() * 6) | 0], suit2: [0x2a3040, 0x4a4a52, 0x2a2a2a][(r() * 3) | 0], sleeve: cs[(r() * 6) | 0], boots: 0x222222, scale: 0.9 + r() * 0.15 }); },
};

/* =========================================================
   COMBINE & CREATURES
========================================================= */
export function makeHeadcrab(scale = 1) {
  const g = new THREE.Group();
  const skin = M.std(0xb7a58a, { roughness: 0.9 }), shell = M.std(0x8a6a4a, { roughness: 0.95 }), dark = M.std(0x1e1512, { roughness: 1 });
  const body = sph(0.26, shell, [0, 0.2, 0], 1.0, 0.8, 1.15); g.add(body);
  const hood = mesh(G('hcr', () => new THREE.SphereGeometry(0.29, 10, 6, 0, TAU, 0, Math.PI * 0.55)), shell, [0, 0.2, -0.02]); hood.scale.set(1.05, 1.0, 1.2); g.add(hood);
  g.add(sph(0.2, dark, [0, 0.09, 0.14], 1, 0.7, 0.9));
  const sp = G('spk', () => new THREE.ConeGeometry(0.018, 0.14, 4));
  for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; const c = new THREE.Mesh(sp, dark); c.position.set(Math.cos(a) * 0.19, 0.09, 0.14 + Math.sin(a) * 0.17); c.rotation.set(Math.sin(a) * 1.0 + Math.PI, 0, -Math.cos(a) * 1.0); g.add(c); }
  g.legs = [];
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const l = new THREE.Group(); l.position.set(sx * 0.15, 0.14, sz * 0.15 + 0.02); g.add(l);
    const up = cyl(0.025, 0.02, 0.28, skin, [sx * 0.12, -0.02, 0]); up.rotation.z = sx * 0.9; l.add(up);
    const lo = cyl(0.02, 0.012, 0.3, skin, [sx * 0.26, -0.14, 0]); lo.rotation.z = -sx * 0.4; l.add(lo);
    g.legs.push(l);
  }
  g.scale.setScalar(scale);
  return g;
}
export function animHeadcrab(g, t, mode = 'crawl') {
  g.legs.forEach((l, i) => { l.rotation.x = mode === 'crawl' ? Math.sin(t * 14 + i * 1.6) * 0.5 : mode === 'jump' ? -0.7 : 0; l.rotation.z = mode === 'jump' ? (i % 2 ? 0.5 : -0.5) : 0; });
}

export class Strider {
  constructor() {
    this.g = new THREE.Group();
    const armor = M.std(0x4a4f46, { metalness: 0.55, roughness: 0.45 });
    const armor2 = M.std(0x2b2f2c, { metalness: 0.5, roughness: 0.5 });
    const bone = M.std(0x6b6a60, { metalness: 0.3, roughness: 0.6 });
    const eyeM = M.emi(0xff7a2a);
    this.armor = armor;
    this.H = 11.5;
    this.body = new THREE.Group(); this.g.add(this.body);
    this.body.add(sph(1.8, armor, [0, 0, 0], 1.0, 0.8, 1.8, 12));
    this.body.add(sph(1.15, armor2, [0, 0.55, -0.9], 1.0, 0.7, 1.7, 10));
    for (let i = 0; i < 5; i++) this.body.add(box(1.6 - i * 0.18, 0.18, 0.5, armor2, [0, 1.05 - i * 0.07, -1.8 + i * 0.85]));
    this.head = new THREE.Group(); this.head.position.set(0, 0.2, 2.5); this.body.add(this.head);
    this.head.add(sph(0.9, armor, [0, 0, 0], 1.0, 0.85, 1.25, 12));
    this.head.add(sph(0.35, eyeM, [0, 0.12, 0.88], 1, 1, 0.5, 8));
    for (const sx of [-1, 1]) { this.head.add(sph(0.2, eyeM, [sx * 0.55, 0.1, 0.65], 1, 1, 0.6, 6)); this.head.add(box(0.1, 1.1, 0.1, bone, [sx * 0.9, -0.8, 0.1])); }
    this.eyeGlow = glowSprite(0xff8a40, 3, 0.8); this.eyeGlow.position.set(0, 0.12, 1.2); this.head.add(this.eyeGlow);
    // warp cannon
    this.cannon = new THREE.Group(); this.cannon.position.set(0, -0.55, 0.6); this.head.add(this.cannon);
    this.cannon.add(cyl(0.22, 0.32, 3.2, armor2, [0, 0, 1.6], 8)); this.cannon.children[0].rotation.x = Math.PI / 2;
    this.muzzleGlow = glowSprite(0x9fe0ff, 4.5, 0); this.muzzleGlow.position.set(0, 0, 3.3); this.cannon.add(this.muzzleGlow);
    // belly minigun
    this.gun = new THREE.Group(); this.gun.position.set(0, -1.2, 1.4); this.body.add(this.gun);
    for (let i = 0; i < 3; i++) { const b = cyl(0.07, 0.07, 1.6, armor2, [Math.cos(i * 2.09) * 0.14, Math.sin(i * 2.09) * 0.14, 0.8], 6); b.rotation.x = Math.PI / 2; this.gun.add(b); }
    this.gunFlash = glowSprite(0xffd890, 2.2, 0); this.gunFlash.position.set(0, 0, 1.8); this.gun.add(this.gunFlash);
    // legs
    this.homes = [V(-5.2, 0, 4.2), V(5.2, 0, 4.2), V(0, 0, -6.2)];
    this.hipOff = [V(-0.9, -1.0, 1.0), V(0.9, -1.0, 1.0), V(0, -0.9, -1.4)];
    this.legs = this.homes.map((h, i) => {
      const up = cyl(1.0, 0.55, 1, armor, [0, 0, 0], 7), lo = cyl(0.55, 0.2, 1, bone, [0, 0, 0], 6);
      const knee = sph(0.85, armor2, [0, 0, 0]), foot = mesh(G('foot', () => new THREE.ConeGeometry(0.22, 1.4, 5)), bone);
      foot.rotation.x = Math.PI;
      const hip = sph(0.62, armor2, [0, 0, 0]);
      this.g.add(up, lo, knee, foot, hip);
      return { up, lo, knee, foot, hip, foot0: h.clone() };
    });
    this.L1 = 7.2; this.L2 = 7.4;
    this.shadow = blob(6); this.shadow.scale.set(6, 1, 9); this.g.add(this.shadow);
    this._h = V(); this._f = V(); this._k = V(); this._dir = V(); this._pole = V(); this._perp = V();
    this.update(0, 0);
  }
  // ph: gait phase (cycles), fireFlash 0..1
  update(ph, stride = 4, opts = {}) {
    const bob = Math.sin(ph * TAU * 3) * 0.18;
    this.body.position.set(0, this.H + bob, 0);
    this.body.rotation.x = (opts.lean || 0);
    this.body.rotation.z = Math.sin(ph * TAU) * 0.03;
    const moving = opts.moving !== false;
    this.legs.forEach((leg, i) => {
      const f = ((ph + i / 3) % 1 + 1) % 1;
      let s = 0, lift = 0;
      if (moving) {
        if (f < 2 / 3) { s = lerp(1, -1, f / (2 / 3)); } else { const u = (f - 2 / 3) * 3; s = lerp(-1, 1, smooth(u)); lift = Math.sin(u * Math.PI) * 2.4; }
      }
      const foot = this._f.copy(leg.foot0); foot.z += s * stride * 0.5 * (i === 2 ? 0.8 : 1); foot.y = 0.2 + lift;
      const hip = this._h.set(this.hipOff[i].x, this.H + bob + this.hipOff[i].y, this.hipOff[i].z);
      const d = this._dir.subVectors(foot, hip); let dist = d.length();
      const maxR = (this.L1 + this.L2) * 0.995;
      if (dist > maxR) { d.multiplyScalar(maxR / dist); dist = maxR; foot.copy(hip).add(d); }
      d.multiplyScalar(1 / dist);
      const a = (this.L1 * this.L1 - this.L2 * this.L2 + dist * dist) / (2 * dist);
      const h = Math.sqrt(Math.max(0, this.L1 * this.L1 - a * a));
      const pole = this._pole.set(Math.sign(foot0x(leg)) * 0.8, 1.2, i === 2 ? -0.6 : 0.4);
      const perp = this._perp.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
      const knee = this._k.copy(hip).addScaledVector(d, a).addScaledVector(perp, h);
      orient(leg.up, hip, knee); orient(leg.lo, knee, foot);
      leg.knee.position.copy(knee); leg.hip.position.copy(hip);
      leg.foot.position.copy(foot).y += 0.5;
    });
    const hy = opts.aimYaw || 0, hp = opts.aimPitch || 0;
    this.head.rotation.set(hp, hy, 0);
    this.muzzleGlow.material.opacity = opts.cannon || 0;
    this.gunFlash.material.opacity = (opts.gun || 0) * (0.6 + 0.4 * Math.sin(ph * 400));
    this.eyeGlow.material.opacity = 0.7 + 0.3 * Math.sin(ph * 20);
  }
}
const foot0x = (leg) => leg.foot0.x || 0.01;

export class Gunship {
  constructor() {
    this.g = new THREE.Group();
    const dark = M.std(0x15191c, { metalness: 0.6, roughness: 0.4 });
    const mid = M.std(0x2b3238, { metalness: 0.5, roughness: 0.5 });
    const glow = M.emi(0x7fd8ff);
    this.g.add(sph(1, dark, [0, 0, 0], 1.0, 0.8, 3.0, 10));
    this.g.add(sph(0.8, mid, [0, -0.2, 2.2], 1.0, 0.9, 1.3, 8));
    this.g.add(sph(0.35, glow, [0, 0.1, 3.0], 1, 1, 0.8, 6));
    const tail = cyl(0.25, 0.1, 5, dark, [0, 0.2, -4.6], 6); tail.rotation.x = Math.PI / 2; this.g.add(tail);
    this.g.add(box(0.1, 1.6, 1.0, mid, [0, 0.9, -7]));
    for (const sx of [-1, 1]) {
      const w = box(3.4, 0.14, 1.4, mid, [sx * 2.4, 0.15, -0.4]); w.rotation.z = -sx * 0.12; this.g.add(w);
      const pod = cyl(0.3, 0.3, 1.8, dark, [sx * 4.1, 0.1, -0.4], 8); pod.rotation.x = Math.PI / 2; this.g.add(pod);
      this.g.add(sph(0.34, glow, [sx * 4.1, 0.1, -1.3], 1, 1, 0.5, 6));
    }
    this.rotor = new THREE.Group(); this.rotor.position.set(0, 1.1, -0.4); this.g.add(this.rotor);
    for (let i = 0; i < 3; i++) { const b = box(6.4, 0.04, 0.3, dark, [0, 0, 0]); b.rotation.y = (i * Math.PI) / 3; this.rotor.add(b); }
    this.light = glowSprite(0x6fd0ff, 3, 0.9); this.light.position.set(0, -0.8, 1.2); this.g.add(this.light);
    this.gunFlash = glowSprite(0xffcf80, 2.4, 0); this.gunFlash.position.set(0, -0.9, 3.4); this.g.add(this.gunFlash);
    this.eng = glowSprite(0x7fd8ff, 2.4, 0.8); this.eng.position.set(0, 0.2, -7.2); this.g.add(this.eng);
    this.g.scale.setScalar(1.0);
  }
  update(T, fire = 0) {
    this.rotor.rotation.y = T * 40;
    this.gunFlash.material.opacity = fire * (0.5 + 0.5 * Math.sin(T * 300));
    this.eng.material.opacity = 0.6 + 0.3 * Math.sin(T * 9);
  }
}

export class Dropship {
  constructor() {
    this.g = new THREE.Group();
    const dark = M.std(0x1a1e22, { metalness: 0.6, roughness: 0.4 });
    const mid = M.std(0x343d43, { metalness: 0.5, roughness: 0.5 });
    const glow = M.emi(0x7fd8ff);
    this.g.add(sph(3.2, dark, [0, 0, 0], 1.3, 0.75, 2.6, 12));
    this.g.add(sph(2.2, mid, [0, 0.1, 6.8], 1.0, 0.85, 1.2, 10));
    this.g.add(sph(0.8, glow, [0, 0.3, 8.4], 1, 1, 0.7, 6));
    for (const sx of [-1, 1]) {
      const p = cyl(1.1, 1.4, 5.5, mid, [sx * 5.2, 0.4, -1.5], 8); p.rotation.x = Math.PI / 2; this.g.add(p);
      this.g.add(box(2.4, 0.3, 4, dark, [sx * 3.6, 0.5, -1.2]));
      const e = glowSprite(0x7fd8ff, 5, 0.9); e.position.set(sx * 5.2, 0.4, -4.4); this.g.add(e);
      const e2 = glowSprite(0x7fd8ff, 4, 0.5); e2.position.set(sx * 5.2, -0.9, -1.5); this.g.add(e2);
    }
    this.g.add(box(2.0, 0.5, 6, dark, [0, 2.2, -2]));
    this.under = glowSprite(0x7fd8ff, 6, 0.55); this.under.position.set(0, -2.3, 0); this.g.add(this.under);
  }
}

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
export function makeJet(c = 0x6b747b, twin = true) {
  const g = new THREE.Group();
  const body = M.std(c, { metalness: 0.45, roughness: 0.5 }), dark = M.std(0x2a2f33, { metalness: 0.5 }), glass = M.std(0xffb36a, { metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.8 });
  const fus = cyl(0.8, 1.05, 11, body, [0, 0, 0], 10); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = mesh(G('nose', () => new THREE.ConeGeometry(0.8, 3.6, 10)), body, [0, 0, 7.2]); nose.rotation.x = Math.PI / 2; g.add(nose);
  g.add(sph(0.55, glass, [0, 0.8, 3.4], 0.9, 0.8, 2.0, 8));
  g.wings = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 1.0, -0.1, 0.5); g.add(piv);
    const w = box(5.0, 0.14, 2.6, body, [sx * 2.5, 0, -0.4]); piv.add(w);
    piv.rotation.y = -sx * 0.45; g.wings.push(piv);
    const eng = cyl(0.62, 0.6, 5.4, dark, [sx * 1.25, -0.1, -2.2], 8); eng.rotation.x = Math.PI / 2; g.add(eng);
    const tail = box(0.1, 2.2, 1.7, body, [sx * 1.5, 1.2, -5.2]); tail.rotation.z = sx * 0.15; g.add(tail);
    const stab = box(2.1, 0.1, 1.5, body, [sx * 2.0, 0.0, -5.3]); g.add(stab);
    const ab = glowSprite(0xffa04a, 3.5, 0); ab.position.set(sx * 1.25, -0.1, -5.2); g.add(ab); g['ab' + (sx > 0 ? 'L' : 'R')] = ab;
  }
  g.afterburn = (v) => { g.abL.material.opacity = v; g.abR.material.opacity = v; };
  g.scale.setScalar(0.9);
  return g;
}

export function makeChinook(cargo = true) {
  const g = new THREE.Group();
  const body = M.std(0x4b5240, { roughness: 0.6 }), dark = M.std(0x23261f);
  g.add(box(2.2, 2.3, 9.5, body, [0, 0, 0]));
  g.add(sph(1.15, body, [0, 0.0, 4.9], 1.0, 1.0, 0.7, 8));
  g.add(box(2.0, 0.4, 1.0, M.std(0x9ac0d6, { metalness: 0.7, roughness: 0.2 }), [0, 0.5, 5.4]));
  g.add(box(1.4, 3, 1.5, dark, [0, 1.0, -4.5]));
  g.add(cyl(0.12, 0.12, 0.6, dark, [0, 1.5, 3]));
  g.add(cyl(0.12, 0.12, 0.6, dark, [0, 1.8, -4.4]));
  g.rotors = [];
  for (const z of [3, -4.4]) { const r = new THREE.Group(); r.position.set(0, z > 0 ? 1.9 : 3.0, z); g.add(r); for (let i = 0; i < 3; i++) { const b = box(10, 0.07, 0.45, dark, [0, 0, 0]); b.rotation.y = (i * Math.PI) / 3 * 1; b.position.set(0, 0, 0); r.add(b); } g.rotors.push(r); }
  if (cargo) { const c = new THREE.Group(); c.position.set(0, -4.2, 0.5); g.add(c); const cr = box(2.4, 2.0, 2.4, M.std(0x7a6a4a), [0, 0, 0]); c.add(cr); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = cyl(0.02, 0.02, 3.2, dark, [x * 0.5, 2.0, z * 0.5], 3); l.rotation.z = -x * 0.15; c.add(l); } g.cargo = c; }
  g.spin = (T) => g.rotors.forEach((r, i) => (r.rotation.y = T * 30 * (i ? -1 : 1)));
  g.scale.setScalar(1.0);
  return g;
}

export function makeTank(c = 0x55603f) {
  const g = new THREE.Group();
  const m = M.std(c, { roughness: 0.65, metalness: 0.2 }), dark = M.std(0x1c1c1a, { roughness: 0.9 });
  g.add(box(3.6, 0.9, 7.6, m, [0, 1.0, 0]));
  for (const sx of [-1, 1]) { g.add(box(0.9, 1.0, 8.2, dark, [sx * 1.9, 0.6, 0])); }
  g.turret = new THREE.Group(); g.turret.position.set(0, 1.9, -0.3); g.add(g.turret);
  g.turret.add(box(2.7, 0.9, 3.6, m, [0, 0, 0]));
  g.gun = cyl(0.17, 0.17, 5.2, dark, [0, 0.1, 4.2], 8); g.gun.rotation.x = Math.PI / 2; g.turret.add(g.gun);
  g.flash = glowSprite(0xffcc88, 4, 0); g.flash.position.set(0, 0.1, 6.9); g.turret.add(g.flash);
  g.scale.setScalar(1.0);
  return g;
}

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
