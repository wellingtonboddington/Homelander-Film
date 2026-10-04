import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export const hexRGB = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export { mixc };

/* ------------------------------------------------------------------
   loft: smooth surface through horizontal rings (y-up).
   rings: [{ y, rx, rz, cx?, cz?, n? (superellipse exponent), f?(angle)=>radial multiplier, c?: [r,g,b] }]
   opts: { seg, color:[r,g,b], colorFn(t, angle, i, pos)=>[r,g,b], capBottom, capTop, bump(t, angle)=>mult }
   angle 0 = +x, PI/2 = +z (front).
------------------------------------------------------------------- */
export function loft(rings, o = {}) {
  const seg = o.seg || 16; const n = rings.length;
  const pos = [], col = [], idx = [];
  const base = o.color || [1, 1, 1];
  for (let i = 0; i < n; i++) {
    const r = rings[i]; const t = n > 1 ? i / (n - 1) : 0;
    const pw = 2 / (r.n || 2);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      let m = r.f ? r.f(a) : 1; if (o.bump) m *= o.bump(t, a);
      const x = Math.sign(c) * Math.pow(Math.abs(c), pw), z = Math.sign(s) * Math.pow(Math.abs(s), pw);
      const px = (r.cx || 0) + x * r.rx * m, pz = (r.cz || 0) + z * r.rz * m;
      pos.push(px, r.y, pz);
      const cc = o.colorFn ? o.colorFn(t, a, i, [px, r.y, pz]) : (r.c || base);
      col.push(cc[0], cc[1], cc[2]);
    }
  }
  const flip = n > 1 && rings[0].y > rings[n - 1].y;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg;
    const v00 = i * seg + j, v01 = i * seg + j1, v10 = (i + 1) * seg + j, v11 = (i + 1) * seg + j1;
    if (!flip) idx.push(v00, v10, v01, v01, v10, v11); else idx.push(v00, v01, v10, v01, v11, v10);
  }
  const cap = (ri, top) => {
    const r = rings[ri]; const ci = pos.length / 3;
    pos.push(r.cx || 0, r.y, r.cz || 0); const cc = o.colorFn ? o.colorFn(ri / Math.max(1, n - 1), 0, ri, [r.cx || 0, r.y, r.cz || 0]) : (r.c || base); col.push(cc[0], cc[1], cc[2]);
    for (let j = 0; j < seg; j++) { const a = ri * seg + j, b = ri * seg + (j + 1) % seg; if (top) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  if (o.capBottom !== false) cap(flip ? n - 1 : 0, false);
  if (o.capTop !== false) cap(flip ? 0 : n - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* tube along a curve with per-point radius; used for hair locks, fingers, cables, straps */
export function tube(points, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = o.steps || Math.max(6, points.length * 3), seg = o.seg || 6;
  const frames = curve.computeFrenetFrames(n, false);
  const pos = [], col = [], idx = [];
  const rad = o.radius || 0.01; const rf = typeof rad === 'function' ? rad : () => rad;
  const flat = o.flat || 1; // flatten along binormal
  const base = o.color || [1, 1, 1];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = curve.getPointAt(t); const N = frames.normals[i], B = frames.binormals[i]; const r = rf(t);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU; const cx = Math.cos(a) * r, cy = Math.sin(a) * r * flat;
      pos.push(p.x + N.x * cx + B.x * cy, p.y + N.y * cx + B.y * cy, p.z + N.z * cx + B.z * cy);
      const cc = o.colorFn ? o.colorFn(t, a) : base; col.push(cc[0], cc[1], cc[2]);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < seg; j++) {
    const j1 = (j + 1) % seg; const a = i * seg + j, b = i * seg + j1, c = (i + 1) * seg + j, d = (i + 1) * seg + j1;
    idx.push(a, b, c, b, d, c);
  }
  // end caps
  const cap = (ring, tip) => { const ci = pos.length / 3; const p = curve.getPointAt(tip); pos.push(p.x, p.y, p.z); const cc = o.colorFn ? o.colorFn(tip, 0) : base; col.push(cc[0], cc[1], cc[2]); for (let j = 0; j < seg; j++) { const a = ring * seg + j, b = ring * seg + (j + 1) % seg; if (tip === 0) idx.push(ci, a, b); else idx.push(ci, b, a); } };
  cap(0, 0); cap(n, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* flat ribbon (hair sheets, cape trims, straps) along a curve; width function; thickness via slight offset */
export function ribbon(points, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const n = o.steps || 12; const wf = typeof o.width === 'function' ? o.width : () => o.width || 0.05;
  const side = o.side ? new THREE.Vector3(...o.side) : new THREE.Vector3(1, 0, 0);
  const pos = [], col = [], idx = []; const base = o.color || [1, 1, 1];
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = curve.getPointAt(t); const w = wf(t) * 0.5;
    const tan = curve.getTangentAt(t); const sd = side.clone().sub(tan.clone().multiplyScalar(side.dot(tan))).normalize();
    const curl = typeof o.curl === 'function' ? o.curl(t) : (o.curl || 0) * Math.sin(t * Math.PI); const nrm = new THREE.Vector3().crossVectors(tan, sd).normalize();
    for (const k of [-1, 0, 1]) { const q = p.clone().addScaledVector(sd, k * w).addScaledVector(nrm, curl * (1 - k * k)); pos.push(q.x, q.y, q.z); const cc = o.colorFn ? o.colorFn(t, k) : base; col.push(cc[0], cc[1], cc[2]); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = i * 3 + k + 1, c = (i + 1) * 3 + k, d = (i + 1) * 3 + k + 1; idx.push(a, c, b, b, c, d); idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* extruded relief from a 2D polygon (emblems) */
export function relief(poly, depth = 0.012, bevel = 0.003, color = [1, 1, 1], scale = 1) {
  const sh = new THREE.Shape(); poly.forEach(([x, y], i) => (i ? sh.lineTo(x * scale, y * scale) : sh.moveTo(x * scale, y * scale)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, 0); paint(g, color); return g;
}
export function paint(g, c) { const n = g.attributes.position.count; const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c[0]; a[i * 3 + 1] = c[1]; a[i * 3 + 2] = c[2]; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
export function xf(g, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), new THREE.Vector3(...s)); g.applyMatrix4(m); return g; }
export function strip(g) { if (g.index) g = g.toNonIndexed(); g.deleteAttribute('uv'); return g; }
export function prep(g) { if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.color) paint(g, [1, 1, 1]); return g; }
export function merge(list) {
  const L = list.filter(Boolean).map((g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.color) paint(g, [1, 1, 1]); return g; });
  if (!L.length) return null; const m = mergeGeometries(L, false); return m;
}
export const sphereG = (r, ws = 12, hs = 8, color) => { const g = new THREE.SphereGeometry(r, ws, hs); if (color) paint(g, color); return g; };
export const boxG = (w, h, d, color) => { const g = new THREE.BoxGeometry(w, h, d); if (color) paint(g, color); return g; };
export const cylG = (r0, r1, h, seg = 10, color) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); if (color) paint(g, color); return g; };

/* smooth gaussian bump helpers */
export const gauss = (d2, w) => Math.exp(-d2 / (w * w));
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* raycast sampler for placing features on a surface */
export function surfaceSampler(geo) {
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rc = new THREE.Raycaster();
  return (x, y, z0 = 0.5, dir = [0, 0, -1]) => { rc.set(new THREE.Vector3(x, y, z0), new THREE.Vector3(...dir)); const h = rc.intersectObject(mesh, false)[0]; return h ? h.point : null; };
}
