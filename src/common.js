import * as THREE from 'three';
import { clamp, lerp, smooth } from './util.js';

export const hex3 = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const _c = new THREE.Color();
const COLOR_PROPS = new Set(['hor', 'zen', 'fogC', 'hemiS', 'hemiG', 'sunC', 'glow', 'bg']);

// moods: [[T, {prop: val}], ...] -> interpolated object (colors as hex ints)
export function moodAt(keys, T) {
  let a = keys[0], b = keys[keys.length - 1], u = 0;
  if (T <= keys[0][0]) b = a;
  else if (T >= keys[keys.length - 1][0]) a = b;
  else for (let i = 0; i < keys.length - 1; i++) if (T >= keys[i][0] && T <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; u = smooth((T - a[0]) / (b[0] - a[0])); break; }
  const out = {};
  for (const k in a[1]) {
    const va = a[1][k], vb = b[1][k] ?? va;
    if (COLOR_PROPS.has(k)) { _c.set(va).lerp(new THREE.Color(vb), u); out[k] = _c.getHex(); }
    else if (Array.isArray(va)) out[k] = va.map((x, i) => lerp(x, vb[i], u));
    else out[k] = lerp(va, vb, u);
  }
  return out;
}

// Catmull-Rom flight track: keys [[t,x,y,z],...]
const out3 = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
function cr(p0, p1, p2, p3, u) { const u2 = u * u, u3 = u2 * u; return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); }
export function sampleTrack(keys, T, o = out3) {
  const n = keys.length;
  if (T <= keys[0][0]) { o.x = keys[0][1]; o.y = keys[0][2]; o.z = keys[0][3]; }
  let i = 0; while (i < n - 2 && T > keys[i + 1][0]) i++;
  const k1 = keys[i], k2 = keys[i + 1], k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
  const u = clamp((T - k1[0]) / (k2[0] - k1[0]));
  const f = (a) => cr(k0[a], k1[a], k2[a], k3[a], u);
  o.x = f(1); o.y = f(2); o.z = f(3);
  const e = 0.05 / (k2[0] - k1[0]), u2 = clamp(u + e);
  const g = (a) => (cr(k0[a], k1[a], k2[a], k3[a], u2) - o['xyz'[a - 1]]) / (e * (k2[0] - k1[0]) || 1);
  o.vx = g(1); o.vy = g(2); o.vz = g(3);
  return o;
}
export function trackVisible(keys, T) { return T >= keys[0][0] && T <= keys[keys.length - 1][0]; }

// orient a flyer (forward = +Z) along track
export function placeFlyer(obj, keys, T, bank = 1.2) {
  const s = sampleTrack(keys, T);
  const s2 = { ...s }; const a = sampleTrack(keys, T - 0.25, {}); const b = sampleTrack(keys, T + 0.25, {});
  const y0 = Math.atan2(a.vx, a.vz), y1 = Math.atan2(b.vx, b.vz);
  let dy = y1 - y0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
  const sp = Math.hypot(s.vx, s.vz) || 1;
  obj.position.set(s.x, s.y, s.z);
  obj.rotation.order = 'YXZ';
  obj.rotation.set(-Math.atan2(s.vy, sp), Math.atan2(s.vx, s.vz), clamp(-dy * bank * 1.5, -1.2, 1.2));
  return s;
}

// piecewise-linear ground path with distance accumulation: keys [[t,x,z,yaw?],...]
export class Path {
  constructor(keys) {
    this.k = keys; this.cum = [0]; this.yaw = [];
    for (let i = 1; i < keys.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(keys[i][1] - keys[i - 1][1], keys[i][2] - keys[i - 1][2]));
    let last = keys[0][3] ?? 0;
    for (let i = 0; i < keys.length - 1; i++) {
      const dx = keys[i + 1][1] - keys[i][1], dz = keys[i + 1][2] - keys[i][2];
      if (keys[i][3] != null) last = keys[i][3]; else if (Math.hypot(dx, dz) > 0.5) last = Math.atan2(dx, dz);
      this.yaw.push(last);
    }
    this.yaw.push(last);
  }
  at(T) {
    const k = this.k; const n = k.length;
    let i = 0; while (i < n - 2 && T > k[i + 1][0]) i++;
    const a = k[i], b = k[i + 1];
    const u = clamp((T - a[0]) / (b[0] - a[0]));
    const x = lerp(a[1], b[1], u), z = lerp(a[2], b[2], u);
    const seg = this.cum[i + 1] - this.cum[i];
    const moving = T > a[0] && T < b[0] && seg > 0.01 && seg / (b[0] - a[0]) < 40;
    return { x, z, yaw: this.yaw[i], dist: this.cum[i] + seg * u, moving, speed: seg / (b[0] - a[0]) };
  }
}
// builder with teleports between non-contiguous segments
export class PathB {
  constructor() { this.k = []; }
  seg(t0, x0, z0, t1, x1, z1, yaw) {
    const k = this.k;
    if (!k.length) { k.push([t0 - 1, x0, z0, yaw]); k.push([t0, x0, z0, yaw]); }
    else {
      const l = k[k.length - 1];
      if (Math.hypot(l[1] - x0, l[2] - z0) > 0.01 || Math.abs(l[0] - t0) > 0.003) {
        if (t0 - 0.002 > l[0]) k.push([t0 - 0.002, l[1], l[2]]);
        k.push([t0, x0, z0, yaw]);
      } else if (yaw != null) l[3] = yaw;
    }
    k.push([t1, x1, z1]);
    return this;
  }
  hold(t0, t1, x, z, yaw) { return this.seg(t0, x, z, t1, x, z, yaw); }
  build() { return new Path(this.k); }
}
export const pick = (list, T) => { if (!list) return null; for (const k of list) if (T >= k[0][0] && T <= k[k.length - 1][0]) return k; return null; };
