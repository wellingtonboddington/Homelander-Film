import * as THREE from 'three';
import { EASE, clamp, lerp, smooth } from './util.js';

const _v = new THREE.Vector3(), _l = new THREE.Vector3();
const sn = (t) => Math.sin(t) * 0.6 + Math.sin(t * 2.31 + 1.3) * 0.3 + Math.sin(t * 4.7 + 2.1) * 0.1;

function resolve(spec, u, k, out) {
  if (typeof spec === 'function') { const r = spec(u, k); out.set(r[0], r[1], r[2]); return out; }
  if (spec.length === 3 && typeof spec[0] === 'number') return out.set(spec[0], spec[1], spec[2]);
  if (spec.length === 2) { const a = spec[0], b = spec[1]; return out.set(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)); }
  // polyline w/ catmull
  if (!spec._curve) spec._curve = new THREE.CatmullRomCurve3(spec.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return spec._curve.getPoint(u, out);
}

/* C({p, l, fov, ease, hand, roll}) -> camera function (k) */
export function C(s) {
  const e = EASE[s.ease || 'io'] || smooth;
  return (k) => {
    const u = e(k.u);
    const cam = k.cam;
    resolve(s.p, u, k, _v); resolve(s.l, u, k, _l);
    const hand = (s.hand ?? 0.5), T = k.T;
    if (hand) {
      _v.x += sn(T * 0.9) * 0.05 * hand; _v.y += sn(T * 1.1 + 5) * 0.05 * hand; _v.z += sn(T * 0.7 + 9) * 0.05 * hand;
      _l.x += sn(T * 1.3 + 2) * 0.04 * hand; _l.y += sn(T * 1.7 + 8) * 0.04 * hand;
    }
    if (s.shake) {
      const a = s.shake * (typeof s.shakeEnv === 'function' ? s.shakeEnv(k.lt, k) : 1);
      _v.x += sn(T * 31) * a; _v.y += sn(T * 37 + 3) * a; _v.z += sn(T * 29 + 7) * a;
      _l.x += sn(T * 33 + 1) * a * 0.8; _l.y += sn(T * 41 + 4) * a * 0.8;
    }
    cam.position.copy(_v);
    cam.up.set(0, 1, 0);
    if (s.roll) { const r = Array.isArray(s.roll) ? lerp(s.roll[0], s.roll[1], u) : s.roll; cam.up.set(Math.sin(r), Math.cos(r), 0); }
    cam.lookAt(_l);
    const f = Array.isArray(s.fov) ? lerp(s.fov[0], s.fov[1], u) : (s.fov ?? 40);
    if (Math.abs(cam.fov - f) > 1e-3) { cam.fov = f; cam.updateProjectionMatrix(); }
    k.film.camFov = f;
  };
}

// orbit helper: returns function(u)->pos
export const orbit = (c, r, a0, a1, h0, h1 = h0) => (u) => {
  const a = lerp(a0, a1, u), h = lerp(h0, h1, u);
  return [c[0] + Math.cos(a) * r, h, c[2] + Math.sin(a) * r];
};
