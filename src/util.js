import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const lin = (t) => clamp(t);
export const EASE = { io: smooth, out: easeOut, in: easeIn, lin };
export const TAU = Math.PI * 2;

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function lerpArr(a, b, t) { return a.map((v, i) => lerp(v, b[i], t)); }

// keyframes: [[t, value], ...] value is number or array
export function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t >= t0 && t <= t1) {
      const u = smooth((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? lerpArr(v0, v1, u) : lerp(v0, v1, u);
    }
  }
  return keys[n - 1][1];
}

const Y = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
// place a unit-height cylinder (axis +Y, height 1) between a and b. radius via scale x/z by caller
export function orient(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length();
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  if (len > 1e-5) mesh.quaternion.setFromUnitVectors(Y, _d.multiplyScalar(1 / len));
  mesh.scale.set(r ?? mesh.scale.x, len, r ?? mesh.scale.z);
}

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const col = (hex) => new THREE.Color(hex);

// canvas helper
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// value noise
const _p = new Float32Array(256 * 256);
{ const r = rng(1337); for (let i = 0; i < _p.length; i++) _p[i] = r(); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = _p[((yi & 255) << 8) | (xi & 255)];
  const b = _p[((yi & 255) << 8) | ((xi + 1) & 255)];
  const c = _p[(((yi + 1) & 255) << 8) | (xi & 255)];
  const d = _p[(((yi + 1) & 255) << 8) | ((xi + 1) & 255)];
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
// tileable-in-x fbm (period px in noise units, integer)
export function fbmTile(x, y, period, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    const p = period * f;
    const xx = x * f;
    const xi = Math.floor(xx), xf = xx - xi;
    const yy = y * f, yi = Math.floor(yy), yf = yy - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const m = (k) => ((k % p) + p) % p;
    const g = (ix, iy) => _p[((iy & 255) << 8) | (m(ix) & 255)];
    s += a * lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
    f *= 2; a *= 0.5;
  }
  return s;
}
