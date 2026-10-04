import * as THREE from 'three';
import { glowTex } from './textures.js';
import { M, box, sph, cyl, mesh, blob, makeGlowStreak } from './models.js';
import { glowSprite } from './fx.js';
import { rng, clamp, lerp, smooth, TAU, V } from './util.js';
import { podTex } from './textures.js';

/* ---------- Pod (headcrab shell) with detachable cap ---------- */
export function makePod() {
  const g = new THREE.Group();
  const orange = M.std(0xd9701a, { metalness: 0.5, roughness: 0.42 }), dark = M.std(0x2a2118, { metalness: 0.6, roughness: 0.5 });
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, TAU, 0.85, Math.PI - 0.85), orange); lower.scale.set(1, 1.45, 1);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, 0.85), orange); cap.scale.set(1, 1.45, 1);
  g.add(lower);
  const capG = new THREE.Group(); capG.add(cap); g.add(capG);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.07, 6, 16).rotateX(Math.PI / 2), dark); rim.position.y = 0.93; g.add(rim);
  for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.97 - i * 0.1, 0.05, 6, 16).rotateX(Math.PI / 2), dark); r.position.y = -0.2 - i * 0.55; g.add(r); }
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshBasicMaterial({ map: podTex(), transparent: true }));
  lab.position.set(0, -0.55, 0.98); g.add(lab);
  const inner = sph(0.7, M.std(0x3a1a10, { roughness: 1 }), [0, 0.9, 0], 1, 0.4, 1); g.add(inner);
  g.userData = { capG };
  return g;
}

export class PodField {
  // pods: [{x,z,t,s,fx,fz,drop}] impact time t; fall duration ~3.2s from offset fx,fz at height 520
  constructor(pods, { fall = 3.2, height = 520, parent, fx }) {
    this.pods = pods; this.fall = fall; this.height = height;
    this.items = pods.map((p) => {
      const g = makePod(); g.scale.setScalar(p.s || 1.6); g.visible = false;
      const st = makeGlowStreak(60, 0xff9a40, 1.8); st.visible = false;
      const gl = glowSprite(0xff8a30, 18, 0.9); gl.visible = false;
      parent.add(g, st, gl);
      if (fx) {
        fx.dustBurst(p.x, 0.8, p.z, p.t, 1.6, 20);
        fx.sparks.add({ x: p.x, y: 1, z: p.z, vx: 0, vy: 9, vz: 0, t0: p.t, life: 1, s0: 0.5, s1: 0.1, c0: [1, 0.7, 0.3, 1], c1: [1, 0.3, 0.05, 0] });
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; fx.sparks.add({ x: p.x, y: 1, z: p.z, vx: Math.cos(a) * 9, vy: 6 + (i % 3) * 3, vz: Math.sin(a) * 9, t0: p.t, life: 1.1, s0: 0.3, s1: 0.05, c0: [1, 0.75, 0.3, 1], c1: [1, 0.3, 0.05, 0] }); }
      }
      return { g, st, gl, p, cap: g.userData.capG };
    });
  }
  update(T) {
    for (const it of this.items) {
      const p = it.p, t0 = p.t - this.fall;
      if (T < t0 || T > p.t + 200) { it.g.visible = it.st.visible = it.gl.visible = false; continue; }
      it.g.visible = true;
      if (T < p.t) {
        const u = (T - t0) / this.fall, e = u * u * 0.4 + u * 0.6;
        const dx = (p.fx ?? 90), dz = (p.fz ?? -60);
        const x = p.x + dx * (1 - e), z = p.z + dz * (1 - e), y = 1.2 + this.height * (1 - e);
        it.g.position.set(x, y, z);
        it.g.rotation.set(0.3 * Math.sin(p.x), T * 1.5, 0.2);
        // streak points from pod back toward launch
        const dir = new THREE.Vector3(dx, this.height, dz).normalize();
        it.st.visible = true; it.st.position.copy(it.g.position);
        it.st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        it.gl.visible = true; it.gl.position.copy(it.g.position);
        it.cap.position.set(0, 0, 0); it.cap.rotation.set(0, 0, 0);
      } else {
        it.st.visible = false;
        const a = T - p.t;
        it.g.position.set(p.x, 1.1 - Math.min(a * 3, 0.3), p.z);
        it.g.rotation.set(0.14 * Math.sin(p.x * 3), p.x, 0.12 * Math.cos(p.z));
        it.gl.visible = a < 0.5; it.gl.position.set(p.x, 3, p.z);
        // cap pops off at +1.0s
        const o = clamp((a - 1.0) / 0.6);
        it.cap.position.set(o * 1.2, o * 2.4 - o * o * 2.0 * (a > 1.6 ? (a - 1.6) * 2 : 0), o * 0.8);
        it.cap.rotation.set(o * 1.1, 0, -o * 1.4);
      }
    }
  }
}

/* ---------- lightweight headcrab swarm ---------- */
function crabLite() {
  const g = new THREE.Group();
  const shell = M.std(0x8a6a4a, { roughness: 0.95 }), dark = M.std(0x1e1512), skin = M.std(0xb7a58a);
  const h = mesh(new THREE.SphereGeometry(0.29, 8, 5, 0, TAU, 0, Math.PI * 0.55), shell, [0, 0.22, 0]); h.scale.set(1.05, 1, 1.25); g.add(h);
  g.add(sph(0.2, dark, [0, 0.1, 0.12], 1, 0.7, 0.9, 6));
  g.legs = [];
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const l = cyl(0.025, 0.012, 0.5, skin, [sx * 0.2, 0.12, sz * 0.14], 4); l.rotation.z = sx * 1.0; g.add(l); g.legs.push(l);
  }
  return g;
}
export class CrabSwarm {
  // from pods list: n crabs each
  constructor(pods, parent, n = 2, seed = 5, tx = 0, tz = 0) {
    const r = rng(seed);
    this.crabs = [];
    pods.forEach((p) => {
      for (let j = 0; j < n; j++) {
        const g = crabLite(); g.visible = false; g.scale.setScalar(1.4 + r() * 0.4); parent.add(g);
        const a = r() * TAU;
        this.crabs.push({ g, x: p.x, z: p.z, t0: p.t + 1.3 + r() * 0.8, ang: a, v: 3.5 + r() * 2.5, th: 0.55 + r() * 0.3, ph: r() * 6, tx: tx + (r() - 0.5) * 20, tz: tz + (r() - 0.5) * 40, tend: p.t + 60 });
      }
    });
  }
  update(T) {
    for (const c of this.crabs) {
      const a = T - c.t0;
      if (a < 0 || T > c.tend) { c.g.visible = false; continue; }
      c.g.visible = true;
      // heading drifts toward target (the avenue / crowd)
      const dxT = c.tx - c.x, dzT = c.tz - c.z;
      const ang = c.ang + Math.sin(a * 0.4 + c.ph) * 0.8 + Math.atan2(Math.sin(Math.atan2(dxT, dzT) - c.ang), Math.cos(Math.atan2(dxT, dzT) - c.ang)) * clamp(a * 0.15, 0, 0.8);
      const hop = (a % c.th) / c.th;
      const dist = c.v * a;
      const x = c.x + Math.sin(ang) * dist, z = c.z + Math.cos(ang) * dist;
      const y = Math.sin(hop * Math.PI) * 0.5;
      c.g.position.set(x, y, z); c.g.rotation.y = ang;
      c.g.legs.forEach((l, i) => (l.rotation.x = Math.sin(a * 16 + i * 1.7) * 0.45));
    }
  }
}

/* ---------- instanced civilians ---------- */
export class Crowd {
  constructor(n, parent, { x0 = -10, x1 = 10, z0 = -200, z1 = 60, seed = 3, t0 = 0, calm = 1.2, panicT = 146, panic = 5.2, fadeT = 520 } = {}) {
    this.n = n; this.o = { x0, x1, z0, z1, t0, calm, panicT, panic, fadeT };
    const r = rng(seed);
    this.body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.9, 3, 6), M.lam(0xffffff), n);
    this.head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 5), M.lam(0xd9a98a), n);
    this.data = [];
    const cs = [0x8a3a3a, 0x3a6a8a, 0x6a8a3a, 0xc9a23a, 0x5a5a6a, 0x8a5a9a, 0xb0b0b0, 0x222222];
    for (let i = 0; i < n; i++) {
      this.body.setColorAt(i, new THREE.Color(cs[(r() * cs.length) | 0]));
      this.data.push({ x: lerp(x0, x1, r()), z: lerp(z0, z1, r()), dir: r() < 0.7 ? 1 : -1, s: 0.8 + r() * 0.5, ph: r() * 6 });
    }
    this.body.frustumCulled = false; this.head.frustumCulled = false;
    parent.add(this.body, this.head);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._e = new THREE.Euler();
  }
  update(T, cam) {
    const o = this.o; const span = o.z1 - o.z0;
    const cnt = T > o.fadeT ? 0 : Math.floor(this.n * (1 - clamp((T - (o.fadeStart ?? 1e9)) / Math.max(1, o.fadeT - (o.fadeStart ?? 1e9)))));
    this.body.count = this.head.count = cnt;
    const travel = o.calm * Math.min(T, o.panicT) + o.panic * Math.max(0, T - o.panicT);
    for (let i = 0; i < cnt; i++) {
      const d = this.data[i];
      let z = d.z + d.dir * travel * d.s; z = o.z0 + (((z - o.z0) % span) + span) % span;
      const near = cam && Math.hypot(d.x - cam.x, z - cam.z) < 6.5 && cam.y < 8;
      const bob = Math.abs(Math.sin(T * 6 * d.s + d.ph)) * 0.06 * (T > o.panicT ? 2 : 1);
      this._e.set(0.15 * (T > o.panicT ? 1 : 0), d.dir > 0 ? 0 : Math.PI, 0);
      this._q.setFromEuler(this._e);
      this._p.set(d.x + Math.sin(T * 0.5 + d.ph) * 0.4, 0.85 + bob, z);
      const sc = near ? 0.0001 : 1; this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s); this.body.setMatrixAt(i, this._m);
      this._p.y = 1.7 + bob; this._m.compose(this._p, this._q, this._s); this.head.setMatrixAt(i, this._m);
    }
    this.body.instanceMatrix.needsUpdate = this.head.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- instanced cars ---------- */
export function makeCars(n, parent, { x = [-9.5, 9.5], z0 = -220, z1 = 60, seed = 21, rows = null, exclude = [] } = {}) {
  const r = rng(seed);
  const bodyG = new THREE.BoxGeometry(1.9, 0.75, 4.4), cabG = new THREE.BoxGeometry(1.7, 0.6, 2.2);
  const bm = new THREE.InstancedMesh(bodyG, M.std(0xffffff, { metalness: 0.5, roughness: 0.4 }), n);
  const cm = new THREE.InstancedMesh(cabG, M.std(0x1a2026, { metalness: 0.7, roughness: 0.2 }), n);
  const cs = [0x8a2a2a, 0x2a4a8a, 0x1a1a1a, 0xc9c9c9, 0x6a6a2a, 0x2a6a4a, 0xb08a2a];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
  const list = [];
  for (let i = 0; i < n; i++) {
    const cx = (rows ? rows[i % rows.length] : (r() < 0.5 ? x[0] : x[1])) + (r() - 0.5) * 1.0;
    let cz = lerp(z0, z1, r()); for (const [a, b] of exclude) if (cz > a && cz < b) cz = b + 6 + r() * 10; const ry = (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * (r() < 0.2 ? 1.6 : 0.08);
    list.push({ x: cx, z: cz, ry });
    e.set(0, ry, 0); q.setFromEuler(e);
    p.set(cx, 0.75, cz); m.compose(p, q, s); bm.setMatrixAt(i, m); bm.setColorAt(i, new THREE.Color(cs[(r() * cs.length) | 0]));
    p.set(cx, 1.4, cz - 0.2 * Math.cos(ry)); m.compose(p, q, s); cm.setMatrixAt(i, m);
  }
  parent.add(bm, cm);
  return { bm, cm, list };
}

/* ---------- lamp posts: instanced poles + additive glow points ---------- */
export function makeLamps(parent, { z0, z1, step = 28, xs = [-13, 13], h = 9, color = 0xffd8a0 }) {
  const pos = [];
  for (let z = z0; z <= z1; z += step) for (const x of xs) pos.push([x, z]);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, h, 5), M.lam(0x2a2a2a), pos.length);
  const m = new THREE.Matrix4();
  const gp = new Float32Array(pos.length * 3);
  pos.forEach(([x, z], i) => { m.makeTranslation(x, h / 2, z); poles.setMatrixAt(i, m); gp.set([x * 0.98, h + 0.2, z], i * 3); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex(), color, size: 8, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  pts.frustumCulled = false; poles.frustumCulled = false;
  parent.add(poles, pts);
  return { poles, pts };
}

/* ---------- canvas screen (live-updating) ---------- */
export class Screen {
  constructor(w, h, draw) {
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.g = this.c.getContext('2d'); this.draw = draw; this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.last = -1; this.w = w; this.h = h;
  }
  update(T, step = 0.25) { const k = Math.floor(T / step); if (k !== this.last) { this.last = k; this.draw(this.g, this.w, this.h, T); this.tex.needsUpdate = true; } }
}
