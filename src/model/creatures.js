import * as THREE from 'three';
import { loft, tube, merge, paint, xf, sphereG, boxG, cylG, mixc, hexRGB } from './geo.js';
import { orient, V, smooth, TAU, rng } from '../util.js';
import { glowSprite } from '../fx.js';

const vm = (props = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.4, ...props });
const emis = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const mesh = (g, m) => new THREE.Mesh(g, m);
const jit = (c, a, k) => [Math.max(0, Math.min(1, c[0] + a * k)), Math.max(0, Math.min(1, c[1] + a * k)), Math.max(0, Math.min(1, c[2] + a * k))];
// rotate a y-axis loft so its axis lies along +z (rings in the xy plane); loft angle pi/2 (+z) becomes world -y (belly)
const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };

/* =============================== STRIDER =============================== */
let SG = null;
function striderGeo() {
  if (SG) return SG;
  const ARM = [0.27, 0.3, 0.26], ARM2 = [0.17, 0.19, 0.17], BONE = [0.5, 0.48, 0.4], RUST = [0.34, 0.2, 0.12], DK = [0.09, 0.1, 0.1];
  const R = rng(5);
  const shellColor = (t, a, i, p) => { const belly = Math.sin(a) > 0.35; const n = 0.05 * Math.sin(p[0] * 7 + p[1] * 3) * Math.sin(p[2] * 6); const band = Math.floor(p[1] * 2.2) % 2 ? 0.03 : -0.02; return belly ? jit(BONE, n - 0.05, 1) : jit(ARM, n + band, 1); };
  // carapace, axis along z: from tail to chest
  const rings = []; const N = 26;
  for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -3.6 + t * 6.4; const env = Math.sin(Math.min(1, t * 1.25 + 0.04) * Math.PI * 0.92); const rx = 0.35 + 1.55 * Math.pow(env, 0.75) * (1 - 0.15 * t); const ry = 0.3 + 1.15 * Math.pow(env, 0.75) * (1 - 0.1 * t); const rib = 1 + 0.045 * Math.sin(z * 7.5); rings.push({ y: z, rx: rx * rib, rz: ry * rib, n: 2.5 }); }
  const carapace = alongZ(loft(rings, { seg: 28, colorFn: shellColor }));
  // dorsal plates
  const plates = [];
  for (let i = 0; i < 7; i++) { const z = -2.8 + i * 0.78; const sc = 1 - Math.abs(i - 3) * 0.07; plates.push(xf(sphereG(1, 12, 8, jit(ARM2, 0.02 * (i % 2), 1)), { p: [0, 1.15 * sc + 0.22 - Math.abs(i - 3) * 0.03, z], r: [-0.12 + i * 0.03, 0, 0], s: [1.15 * sc, 0.22, 0.46] })); }
  // spines along the back
  for (let i = 0; i < 9; i++) { const z = -3 + i * 0.62; plates.push(xf(new THREE.ConeGeometry(0.1, 0.55 - Math.abs(i - 4) * 0.04, 6), { p: [0, 1.5 - Math.abs(i - 4) * 0.08, z], r: [-0.3, 0, 0] })); paint(plates[plates.length - 1], jit(RUST, 0, 1)); }
  // side armour flanges
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) plates.push(xf(sphereG(1, 10, 8, jit(ARM2, 0.03, 1)), { p: [sx * 1.55, 0.1 - i * 0.05, -1.4 + i * 1.05], r: [0, 0, sx * -0.6], s: [0.12, 0.62, 0.52] }));
  const hull = merge([carapace, ...plates]);
  // head (axis along z) + visor cowl
  const hr = []; for (let i = 0; i < 14; i++) { const t = i / 13; const z = 2.2 + t * 1.8; const env = Math.cos(t * Math.PI * 0.5 * 0.96); hr.push({ y: z, rx: 0.95 * Math.pow(env, 0.6) + 0.05, rz: 0.82 * Math.pow(env, 0.6) + 0.05, n: 2.4 }); }
  const head = [alongZ(loft(hr, { seg: 24, colorFn: (t, a, i, p) => jit(ARM, 0.03 * Math.sin(p[1] * 8), 1) }))];
  head.push(xf(sphereG(1, 12, 8, ARM2), { p: [0, 0.65, 2.7], r: [-0.4, 0, 0], s: [0.5, 0.18, 0.9] })); // brow crest
  for (const sx of [-1, 1]) { head.push(xf(sphereG(1, 10, 8, ARM2), { p: [sx * 0.88, -0.1, 2.9], r: [0, 0, sx * 0.4], s: [0.1, 0.55, 0.55] })); head.push(tube([[sx * 0.7, -0.3, 3.3], [sx * 1.0, -1.1, 3.1], [sx * 0.8, -1.8, 3.4]], { radius: (t) => 0.13 - 0.08 * t, seg: 6, color: jit(BONE, -0.05, 1), steps: 8 })); }
  const headG = merge(head);
  // visor and lamps (emissive)
  const visor = merge([tube([[-0.62, 0.16, 3.33], [-0.3, 0.2, 3.62], [0, 0.22, 3.7], [0.3, 0.2, 3.62], [0.62, 0.16, 3.33]], { radius: 0.12, flat: 0.8, seg: 8, color: [1, 0.5, 0.15], steps: 16 })]);
  const lamps = merge([xf(sphereG(0.17, 10, 8, [1, 0.6, 0.2]), { p: [-0.7, -0.15, 3.1], s: [1, 1, 0.5] }), xf(sphereG(0.17, 10, 8, [1, 0.6, 0.2]), { p: [0.7, -0.15, 3.1], s: [1, 1, 0.5] }), xf(sphereG(0.3, 12, 9, [1, 0.7, 0.3]), { p: [0, 0.18, 3.55], s: [1.3, 0.6, 0.5] })]);
  // warp cannon barrel (axis z) with bands
  const cr = []; for (let i = 0; i < 18; i++) { const t = i / 17; const band = Math.floor(i / 3) % 2; const r = (0.26 + (band ? 0.04 : 0)) * (1 - 0.18 * t); cr.push({ y: t * 3.6, rx: r, rz: r, n: 2 }); }
  const barrel = alongZ(loft(cr, { seg: 14, colorFn: (t, a, i) => (Math.floor(i / 3) % 2 ? jit(DK, 0.02, 1) : jit(ARM2, 0, 1)) }));
  const mount = merge([xf(sphereG(0.5, 12, 8, ARM2), { p: [0, 0, -0.1], s: [1, 0.8, 1.2] }), xf(boxG(0.1, 0.55, 0.1, DK), { p: [-0.32, 0.2, 0.4] }), xf(boxG(0.1, 0.55, 0.1, DK), { p: [0.32, 0.2, 0.4] })]);
  const muzzle = xf(new THREE.TorusGeometry(0.3, 0.07, 6, 16), { p: [0, 0, 3.6] }); paint(muzzle, [0.5, 0.8, 1]);
  const cannon = merge([barrel, mount]);
  // belly minigun
  const gun = [xf(cylG(0.32, 0.38, 0.9, 10, DK), { p: [0, 0, 0.4], r: [Math.PI / 2, 0, 0] })];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; gun.push(xf(cylG(0.05, 0.05, 1.5, 6, [0.05, 0.05, 0.06]), { p: [Math.cos(a) * 0.17, Math.sin(a) * 0.17, 1.4], r: [Math.PI / 2, 0, 0] })); }
  gun.push(xf(sphereG(0.42, 10, 8, ARM2), { p: [0, 0.2, 0], s: [1, 0.8, 1] })); gun.push(xf(cylG(0.28, 0.28, 0.4, 10, RUST), { p: [0.5, 0.1, 0.1], r: [0, 0, Math.PI / 2] }));
  const gunG = merge(gun);
  // cables hanging from the belly
  const cab = []; for (let i = 0; i < 5; i++) { const x = -0.7 + i * 0.35; cab.push(tube([[x, -1.0, -0.4 + (i % 2) * 0.5], [x + 0.1, -1.7, -0.3 + (i % 2) * 0.4], [x - 0.1, -2.5, -0.1 + (i % 2) * 0.3]], { radius: 0.06, seg: 5, color: jit(DK, 0.04, 1), steps: 8 })); }
  const cablesG = merge(cab);
  // legs (unit length along y, centred; hip end y=-0.5 (thick), knee end y=+0.5)
  const seg = (rin, rout, ridges, color, n = 12) => { const r = []; for (let i = 0; i < n; i++) { const t = i / (n - 1); const base = rin + (rout - rin) * t; const rr = base * (1 + 0.1 * Math.max(0, Math.sin(t * ridges * Math.PI * 2))); r.push({ y: -0.5 + t, rx: rr, rz: rr * 0.92 }); } return loft(r, { seg: 12, colorFn: (t, a, i, p) => jit(color, 0.03 * Math.sin(p[1] * 24 + a), 1) }); };
  const upper = seg(0.95, 0.5, 4, ARM); const lower = seg(0.52, 0.17, 3, BONE, 14);
  const knee = merge([sphereG(0.78, 12, 9, ARM2), ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * TAU; return xf(new THREE.ConeGeometry(0.16, 0.7, 5), { p: [Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.1], r: [0, 0, a - Math.PI / 2] }); }), ...[0, 1, 2, 3, 4].map(() => xf(cylG(0.07, 0.07, 1.2, 5, DK), { p: [0.3, 0.55, 0.4], r: [0.3, 0, 0.6] }))]);
  paint(knee, ARM2);
  const kneeG = merge([xf(sphereG(0.8, 12, 9, ARM2), {}), ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * TAU + 0.3; return xf(new THREE.ConeGeometry(0.15, 0.62, 5), { p: [Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0], r: [0, 0, a - Math.PI / 2], s: [1, 1, 1] }); }).map((g) => paint(g, jit(RUST, 0, 1)))]);
  const hipG = merge([sphereG(0.78, 12, 9, ARM2), xf(new THREE.TorusGeometry(0.72, 0.1, 6, 18), { r: [Math.PI / 2, 0, 0] })].map((g, i) => paint(g, i ? DK : ARM2)));
  const claws = []; for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; claws.push(xf(new THREE.ConeGeometry(0.16, 1.5, 5), { p: [Math.cos(a) * 0.5, -0.45, Math.sin(a) * 0.5], r: [Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75] })); paint(claws[i], jit(BONE, -0.08, 1)); }
  claws.push(paint(sphereG(0.3, 8, 6), jit(DK, 0.05, 1))); claws.push(xf(new THREE.ConeGeometry(0.2, 1.6, 6), { p: [0, -0.3, 0], r: [Math.PI, 0, 0] }));
  paint(claws[claws.length - 1], jit(BONE, -0.06, 1));
  SG = { hull, head: headG, visor, lamps, cannon, muzzle, gun: gunG, cables: cablesG, upper, lower, knee: kneeG, hip: hipG, foot: merge(claws) };
  return SG;
}

export class Strider {
  constructor() {
    const G = striderGeo();
    this.g = new THREE.Group();
    const m = vm({ roughness: 0.5, metalness: 0.45 });
    this.H = 11.5;
    this.body = new THREE.Group(); this.g.add(this.body);
    this.body.add(mesh(G.hull, m));
    this.body.scale.setScalar(1.12);
    this.head = new THREE.Group(); this.body.add(this.head);
    this.head.add(mesh(G.head, m)); this.head.add(mesh(G.visor, emis(0xff7a2a))); this.head.add(mesh(G.lamps, emis(0xffa050)));
    this.eyeGlow = glowSprite(0xff8a40, 3.4, 0.8); this.eyeGlow.position.set(0, 0.2, 3.9); this.head.add(this.eyeGlow);
    this.cannon = new THREE.Group(); this.cannon.position.set(0, -0.75, 1.1); this.head.add(this.cannon);
    this.cannon.add(mesh(G.cannon, m)); this.cannon.add(mesh(G.muzzle, emis(0x9fe0ff)));
    this.muzzleGlow = glowSprite(0x9fe0ff, 5, 0); this.muzzleGlow.position.set(0, 0, 3.7); this.cannon.add(this.muzzleGlow);
    this.gun = new THREE.Group(); this.gun.position.set(0, -1.15, 1.3); this.body.add(this.gun); this.gun.add(mesh(G.gun, m));
    this.gunFlash = glowSprite(0xffd890, 2.4, 0); this.gunFlash.position.set(0, 0, 2.2); this.gun.add(this.gunFlash);
    const cb = mesh(G.cables, m); cb.position.set(0, -0.2, 0); this.body.add(cb); this.cables = cb;
    this.homes = [V(-5.2, 0, 4.2), V(5.2, 0, 4.2), V(0, 0, -6.2)];
    this.hipOff = [V(-1.0, -1.0, 1.1), V(1.0, -1.0, 1.1), V(0, -0.85, -1.6)];
    this.legs = this.homes.map((h) => {
      const up = mesh(G.upper, m), lo = mesh(G.lower, m), knee = mesh(G.knee, m), foot = mesh(G.foot, m), hip = mesh(G.hip, m);
      this.g.add(up, lo, knee, foot, hip);
      return { up, lo, knee, foot, hip, foot0: h.clone() };
    });
    this.L1 = 7.2; this.L2 = 7.4;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false })); this.shadow.scale.set(6, 1, 9); this.shadow.position.y = 0.03; this.g.add(this.shadow);
    this._h = V(); this._f = V(); this._k = V(); this._dir = V(); this._pole = V(); this._perp = V();
    this.update(0, 0);
  }
  update(ph, stride = 4, opts = {}) {
    const bob = Math.sin(ph * TAU * 3) * 0.18;
    this.body.position.set(0, this.H + bob, 0);
    this.body.rotation.x = (opts.lean || 0);
    this.body.rotation.z = Math.sin(ph * TAU) * 0.03;
    this.cables.rotation.x = Math.sin(ph * TAU * 3 + 1) * 0.12; this.cables.rotation.z = Math.sin(ph * TAU * 2) * 0.1;
    const moving = opts.moving !== false;
    this.legs.forEach((leg, i) => {
      const f = ((ph + i / 3) % 1 + 1) % 1;
      let s = 0, lift = 0;
      if (moving) { if (f < 2 / 3) s = 1 - 2 * (f / (2 / 3)); else { const u = (f - 2 / 3) * 3; s = -1 + 2 * smooth(u); lift = Math.sin(u * Math.PI) * 2.4; } }
      const foot = this._f.copy(leg.foot0); foot.z += s * stride * 0.5 * (i === 2 ? 0.8 : 1); foot.y = 0.2 + lift;
      const hip = this._h.set(this.hipOff[i].x, this.H + bob + this.hipOff[i].y, this.hipOff[i].z);
      const d = this._dir.subVectors(foot, hip); let dist = d.length();
      const maxR = (this.L1 + this.L2) * 0.995;
      if (dist > maxR) { d.multiplyScalar(maxR / dist); dist = maxR; foot.copy(hip).add(d); }
      d.multiplyScalar(1 / dist);
      const a = (this.L1 * this.L1 - this.L2 * this.L2 + dist * dist) / (2 * dist);
      const h = Math.sqrt(Math.max(0, this.L1 * this.L1 - a * a));
      const pole = this._pole.set(Math.sign(leg.foot0.x || 0.01) * 0.8, 1.2, i === 2 ? -0.6 : 0.4);
      const perp = this._perp.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
      const knee = this._k.copy(hip).addScaledVector(d, a).addScaledVector(perp, h);
      orient(leg.up, hip, knee, 1); orient(leg.lo, knee, foot, 1);
      leg.knee.position.copy(knee); leg.hip.position.copy(hip); leg.foot.position.copy(foot).y += 0.45;
    });
    const hy = opts.aimYaw || 0, hp = opts.aimPitch || 0;
    this.head.rotation.set(hp, hy, 0);
    this.muzzleGlow.material.opacity = opts.cannon || 0;
    this.gunFlash.material.opacity = (opts.gun || 0) * (0.6 + 0.4 * Math.sin(ph * 400));
    this.eyeGlow.material.opacity = 0.7 + 0.3 * Math.sin(ph * 20);
  }
}

/* =============================== HEADCRAB =============================== */
let HG = null;
function crabGeo() {
  if (HG) return HG;
  const SHELL = [0.55, 0.42, 0.28], SKIN = [0.72, 0.64, 0.5], DK = [0.1, 0.07, 0.06], FANG = [0.85, 0.8, 0.68];
  // hooded back: loft axis z (front +z)
  const rings = []; const N = 14; for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -0.34 + t * 0.62; const env = Math.sin(Math.pow(t, 0.8) * Math.PI * 0.95 + 0.05); rings.push({ y: z, rx: 0.06 + 0.25 * env, rz: 0.04 + 0.2 * env, n: 2.3, f: (a) => 1 + 0.06 * Math.sin(a * 9) * (a > 0.3 && a < Math.PI - 0.3 ? 0 : 1) }); }
  const hood = alongZ(loft(rings, { seg: 22, colorFn: (t, a, i, p) => (Math.sin(a) > 0.2 ? jit(SKIN, -0.05, 1) : jit(SHELL, 0.05 * Math.sin(p[1] * 30 + p[0] * 20), 1)) }));
  hood.translate(0, 0.2, 0);
  const ridges = []; for (let i = 0; i < 6; i++) ridges.push(xf(sphereG(1, 8, 6, jit(SHELL, -0.06, 1)), { p: [0, 0.44 - Math.abs(i - 2.5) * 0.014, -0.2 + i * 0.1], s: [0.18, 0.04, 0.05] }));
  const maw = [xf(sphereG(0.2, 12, 9, DK), { p: [0, 0.1, 0.12], s: [1, 0.55, 1.0] })];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; const c = xf(new THREE.ConeGeometry(0.018, 0.12, 5), { p: [Math.cos(a) * 0.2, 0.07, 0.12 + Math.sin(a) * 0.19], r: [Math.sin(a) * 0.9 + Math.PI, 0, -Math.cos(a) * 0.9] }); paint(c, FANG); maw.push(c); }
  const lipRing = xf(new THREE.TorusGeometry(0.2, 0.035, 6, 18), { p: [0, 0.09, 0.12], r: [Math.PI / 2, 0, 0], s: [1, 1.05, 1] }); paint(lipRing, jit(SKIN, -0.1, 1)); maw.push(lipRing);
  HG = { body: merge([hood, ...ridges]), maw: merge(maw) };
  return HG;
}
export function makeHeadcrab(scale = 1) {
  const G = crabGeo(); const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  g.add(mesh(G.body, m)); g.add(mesh(G.maw, m));
  g.legs = [];
  const skin = hexRGB(0xb7a58a);
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const l = new THREE.Group(); l.position.set(sx * 0.13, 0.16, sz * 0.14 + 0.03); g.add(l);
    const leg = merge([tube([[0, 0, 0], [sx * 0.14, 0.1, sz * 0.02], [sx * 0.27, 0.04, sz * 0.05]], { radius: (t) => 0.026 - 0.008 * t, seg: 6, color: skin, steps: 6 }), tube([[sx * 0.27, 0.04, sz * 0.05], [sx * 0.36, -0.06, sz * 0.09], [sx * 0.4, -0.16, sz * 0.12]], { radius: (t) => 0.02 - 0.012 * t, seg: 5, color: jit(skin, -0.12, 1), steps: 6 }), xf(sphereG(0.03, 6, 5, skin), { p: [sx * 0.27, 0.04, sz * 0.05] }), xf(new THREE.ConeGeometry(0.012, 0.07, 4), { p: [sx * 0.4, -0.2, sz * 0.12] })]);
    l.add(mesh(leg, m)); g.legs.push(l);
  }
  g.scale.setScalar(scale); return g;
}
export function animHeadcrab(g, t, mode = 'crawl') {
  g.legs.forEach((l, i) => { l.rotation.x = mode === 'crawl' ? Math.sin(t * 14 + i * 1.6) * 0.5 : mode === 'jump' ? -0.7 : 0; l.rotation.z = mode === 'jump' ? (i % 2 ? 0.5 : -0.5) : 0; });
}

/* =============================== GUNSHIP / DROPSHIP =============================== */
let GG = null;
function gunshipGeo() {
  if (GG) return GG;
  const K = [0.1, 0.11, 0.13], K2 = [0.2, 0.23, 0.26], BL = [0.45, 0.82, 1];
  const rings = []; const N = 24; for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -6.5 + t * 11; let r; if (t < 0.55) r = 0.45 + 1.15 * Math.sin((t / 0.55) * Math.PI * 0.5); else r = 1.6 * Math.cos(((t - 0.55) / 0.45) * Math.PI * 0.46); rings.push({ y: z, rx: r * 0.92, rz: r * 0.82, n: 2.5 }); }
  // tail boom narrower
  const tail = []; for (let i = 0; i < 10; i++) { const t = i / 9; tail.push({ y: -9.5 + t * 3.6, rx: 0.2 + 0.3 * t * t, rz: 0.2 + 0.26 * t * t, n: 2.1 }); }
  const fus = alongZ(loft(rings, { seg: 22, colorFn: (t, a, i, p) => (Math.sin(a) > 0.5 ? jit(K2, 0.02 * Math.sin(p[1] * 6), 1) : jit(K, 0.03 * Math.sin(p[1] * 9 + a * 3), 1)) }));
  const tb = alongZ(loft(tail, { seg: 12, color: K }));
  const parts = [fus, tb];
  parts.push(xf(sphereG(1, 12, 8, K2), { p: [0, 0.95, 0.4], s: [0.7, 0.4, 2.3] }));
  for (const sx of [-1, 1]) {
    parts.push(xf(boxG(3.6, 0.14, 1.7, K2), { p: [sx * 2.7, 0.15, -0.4], r: [0, sx * 0.15, sx * -0.12] }));
    parts.push(xf(boxG(1.3, 0.1, 0.8, K), { p: [sx * 1.4, 0.2, -1.2] }));
    parts.push(alongZ(loft([{ y: -1.2, rx: 0.34, rz: 0.34 }, { y: 0.0, rx: 0.4, rz: 0.4 }, { y: 1.0, rx: 0.32, rz: 0.32 }], { seg: 10, color: K, capTop: true })).translate(sx * 4.4, 0.1, -0.6));
    parts.push(xf(boxG(0.14, 1.9, 1.4, K2), { p: [sx * 0.9, 1.3, -8.4], r: [0, 0, sx * 0.25] }));    // tail fins
    parts.push(xf(boxG(2.2, 0.1, 0.9, K), { p: [sx * 1.2, 0.2, -8.9] }));
  }
  parts.push(xf(boxG(0.14, 1.8, 1.6, K2), { p: [0, 1.1, -8.7] }));
  for (let i = 0; i < 5; i++) parts.push(xf(boxG(1.6 - i * 0.12, 0.05, 0.12, K), { p: [0, 0.9 + i * 0.015, -3 + i * 0.9] }));
  // chin cannon
  parts.push(xf(sphereG(0.6, 10, 8, K2), { p: [0, -1.0, 3.2], s: [1, 0.8, 1.2] }));
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; parts.push(xf(cylG(0.07, 0.07, 1.9, 6, [0.04, 0.04, 0.05]), { p: [Math.cos(a) * 0.14, -1.1 + Math.sin(a) * 0.14, 4.1], r: [Math.PI / 2, 0, 0] })); }
  parts.push(xf(sphereG(0.5, 10, 8, K), { p: [0, -1.0, 0.2], s: [1.4, 0.6, 2.2] })); // bomb bay
  const hull = merge(parts);
  const glow = merge([xf(sphereG(0.38, 8, 6, BL), { p: [0, 0.35, 5.0], s: [1.6, 0.6, 0.6] }), xf(boxG(0.1, 0.06, 5, BL), { p: [-1.3, 0.1, -0.5] }), xf(boxG(0.1, 0.06, 5, BL), { p: [1.3, 0.1, -0.5] }), xf(sphereG(0.36, 8, 6, BL), { p: [-4.4, 0.1, -1.7], s: [1, 1, 0.5] }), xf(sphereG(0.36, 8, 6, BL), { p: [4.4, 0.1, -1.7], s: [1, 1, 0.5] })]);
  GG = { hull, glow }; return GG;
}
export class Gunship {
  constructor() {
    const G = gunshipGeo(); this.g = new THREE.Group();
    this.g.add(mesh(G.hull, vm({ roughness: 0.4, metalness: 0.6 }))); this.g.add(mesh(G.glow, emis(0x7fd8ff)));
    this.rotor = new THREE.Group(); this.rotor.position.set(0, 1.55, -0.4); this.g.add(this.rotor);
    const rb = []; for (let i = 0; i < 3; i++) rb.push(xf(boxG(7.4, 0.05, 0.34, [0.07, 0.08, 0.09]), { r: [0, (i * Math.PI) / 3, 0] }));
    rb.push(xf(cylG(0.3, 0.3, 0.3, 10, [0.15, 0.16, 0.18]), {})); this.rotor.add(mesh(merge(rb), vm()));
    this.light = glowSprite(0x6fd0ff, 3.4, 0.9); this.light.position.set(0, -1.4, 1.6); this.g.add(this.light);
    this.gunFlash = glowSprite(0xffcf80, 2.6, 0); this.gunFlash.position.set(0, -1.1, 5.2); this.g.add(this.gunFlash);
    this.eng = glowSprite(0x7fd8ff, 2.6, 0.8); this.eng.position.set(0, 0.2, -9.6); this.g.add(this.eng);
  }
  update(T, fire = 0) { this.rotor.rotation.y = T * 40; this.gunFlash.material.opacity = fire * (0.5 + 0.5 * Math.sin(T * 300)); this.eng.material.opacity = 0.6 + 0.3 * Math.sin(T * 9); }
}

let DG = null;
function dropshipGeo() {
  if (DG) return DG; const K = [0.12, 0.14, 0.16], K2 = [0.24, 0.27, 0.3], BL = [0.45, 0.82, 1];
  const rings = []; const N = 26; for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -9 + t * 18.5; const env = Math.sin(Math.pow(t, 0.9) * Math.PI * 0.97 + 0.03); rings.push({ y: z, rx: 0.8 + 3.6 * Math.pow(env, 0.7), rz: 0.6 + 2.5 * Math.pow(env, 0.7), n: 2.6 }); }
  const fus = alongZ(loft(rings, { seg: 26, colorFn: (t, a, i, p) => (Math.sin(a) > 0.4 ? jit(K, 0.02 * Math.sin(p[1] * 4), 1) : jit(K2, 0.03 * Math.sin(p[1] * 7 + a * 4), 1)) }));
  const parts = [fus];
  for (const sx of [-1, 1]) {
    parts.push(alongZ(loft([{ y: -4.5, rx: 1.2, rz: 1.2 }, { y: -2.5, rx: 1.45, rz: 1.45 }, { y: 1.5, rx: 1.35, rz: 1.35 }, { y: 3.5, rx: 0.9, rz: 0.9 }], { seg: 14, color: K2 })).translate(sx * 5.4, 0.4, -1.5));
    parts.push(xf(boxG(2.6, 0.3, 4.2, K), { p: [sx * 3.7, 0.5, -1.2] }));
    parts.push(xf(boxG(0.2, 2.6, 2.4, K2), { p: [sx * 6.5, 1.3, -5.4], r: [0, 0, sx * 0.2] }));
    for (let i = 0; i < 3; i++) parts.push(xf(cylG(0.08, 0.1, 2.6, 6, K), { p: [sx * (1.5 + i * 0.9), -2.5, -3 + i * 3.2], r: [0, 0, sx * 0.25] }));    // landing struts
  }
  parts.push(xf(boxG(2.4, 0.5, 6.5, K2), { p: [0, 2.4, -2.5] }));
  parts.push(xf(sphereG(1, 12, 8, K2), { p: [0, 0.2, 9.0], s: [1.8, 1.4, 2.2] }));
  const hull = merge(parts);
  const glow = merge([xf(sphereG(0.8, 8, 6, BL), { p: [0, 0.4, 10.6], s: [1.6, 0.6, 0.5] }), xf(sphereG(0.9, 8, 6, BL), { p: [-5.4, 0.4, -5.2], s: [1, 1, 0.5] }), xf(sphereG(0.9, 8, 6, BL), { p: [5.4, 0.4, -5.2], s: [1, 1, 0.5] }), xf(boxG(7, 0.1, 0.12, BL), { p: [0, -0.3, 3] })]);
  DG = { hull, glow }; return DG;
}
export class Dropship {
  constructor() {
    const G = dropshipGeo(); this.g = new THREE.Group();
    this.g.add(mesh(G.hull, vm({ roughness: 0.45, metalness: 0.55 }))); this.g.add(mesh(G.glow, emis(0x7fd8ff)));
    for (const sx of [-1, 1]) { const e = glowSprite(0x7fd8ff, 5.5, 0.9); e.position.set(sx * 5.4, 0.4, -5.6); this.g.add(e); const e2 = glowSprite(0x7fd8ff, 4, 0.5); e2.position.set(sx * 5.4, -1.0, -1.5); this.g.add(e2); }
    this.under = glowSprite(0x7fd8ff, 7, 0.55); this.under.position.set(0, -2.6, 0); this.g.add(this.under);
  }
}
