import * as THREE from 'three';
import { loft, tube, ribbon, merge, paint, xf, sphereG, boxG, cylG, mixc, hexRGB, smoothstep, surfaceSampler } from './geo.js';
import { rng } from '../util.js';

const RX = 0.082, RY = 0.103, RZ = 0.096, CY = 0.096;           // head ellipsoid (pivot = skull base)
export const HEAD = { RX, RY, RZ, CY };
const g2 = (x, y, z, cx, cy, cz, w) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (w * w));
const vary = (c, a, k) => [Math.min(1, Math.max(0, c[0] + a * k)), Math.min(1, Math.max(0, c[1] + a * k)), Math.min(1, Math.max(0, c[2] + a * k))];

function headShell(sp) {
  const g = new THREE.SphereGeometry(1, sp.lod ? 34 : 64, sp.lod ? 24 : 46);
  const P = g.attributes.position, N = g.attributes.normal;
  const jaw = sp.jaw ?? 1, chin = sp.chin ?? 0.5, brow = sp.brow ?? 0.5, cheek = sp.cheek ?? 0.5, age = sp.age ?? 0.2, fem = sp.fem ? 1 : 0;
  const skin = sp.skin, col = [];
  for (let i = 0; i < P.count; i++) {
    const ux = P.getX(i), uy = P.getY(i), uz = P.getZ(i);
    let x = ux * RX, y = uy * RY, z = uz * RZ;
    const jf = smoothstep(0.1, -1.0, uy);
    x *= 1 - (0.29 - 0.12 * (jaw - 1) - 0.05 * fem) * Math.pow(jf, 1.2);
    if (uz > 0) z *= 1 - 0.13 * jf; else z *= 1 + 0.09 * (-uz) * (1 - jf * 0.5);
    y *= 1 - 0.035 * smoothstep(0.7, 1, uy);
    if (uy < -0.55) y = Math.max(y, -RY * 0.96);
    let d = 0;
    d += 0.009 * brow * Math.exp(-(((uy - 0.30) / 0.10) ** 2)) * smoothstep(0.15, 0.7, uz);
    d += 0.0085 * chin * g2(ux, uy, uz, 0, -0.86, 0.5, 0.22);
    d += 0.012 * (jaw - 0.9) * (g2(ux, uy, uz, 0.62, -0.62, 0.15, 0.2) + g2(ux, uy, uz, -0.62, -0.62, 0.15, 0.2));
    for (const sx of [-1, 1]) {
      d -= 0.0075 * g2(ux, uy, uz, sx * 0.40, 0.05, 0.9, 0.15);                        // eye sockets
      d += 0.0075 * cheek * (1 - 0.5 * fem * 0.4) * g2(ux, uy, uz, sx * 0.62, -0.1, 0.72, 0.2);   // cheekbones
      d -= (0.004 + 0.004 * age) * g2(ux, uy, uz, sx * 0.5, -0.42, 0.74, 0.17);        // cheek hollows
      d -= 0.004 * g2(ux, uy, uz, sx * 0.9, 0.18, 0.35, 0.18);                         // temples
      d += 0.003 * g2(ux, uy, uz, sx * 0.55, -0.32, 0.8, 0.08);                        // smile line
    }
    d += 0.006 * g2(ux, uy, uz, 0, -0.56, 0.85, 0.2);                                   // muzzle
    d -= 0.002 * (1 - fem) * g2(ux, uy, uz, 0, -0.64, 0.8, 0.1);                         // under-lip dip
    x += ux * d; y += uy * d; z += uz * d;
    P.setXYZ(i, x, y + CY, z);
    // skin tone: warm cheeks/nose, cooler under eyes
    let k = 0.045 * g2(ux, uy, uz, 0, -0.18, 0.96, 0.5) - 0.03 * (g2(ux, uy, uz, 0.42, 0.0, 0.9, 0.16) + g2(ux, uy, uz, -0.42, 0.0, 0.9, 0.16));
    const c = vary(skin, k, 1); col.push(c[0] * (1 + 0.02 * k), c[1] * (1 - 0.04 * Math.max(0, k)), c[2] * (1 - 0.06 * Math.max(0, k)));
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('uv'); g.computeVertexNormals();
  return g;
}

// keep triangles whose three vertices pass pred(x,y,z); optionally offset along normal
function subsurface(src, pred, off, colorFn, thick) {
  const g = src.index ? src.toNonIndexed() : src.clone();
  const P = g.attributes.position; const N = g.attributes.normal; if (!N) g.computeVertexNormals();
  const Nn = g.attributes.normal; const keep = [];
  for (let t = 0; t < P.count; t += 3) {
    let ok = true; for (let k = 0; k < 3; k++) if (!pred(P.getX(t + k), P.getY(t + k), P.getZ(t + k))) { ok = false; break; }
    if (ok) keep.push(t);
  }
  const pos = [], nor = [], col = [];
  for (const t of keep) for (let k = 0; k < 3; k++) {
    const x = P.getX(t + k), y = P.getY(t + k), z = P.getZ(t + k); const nx = Nn.getX(t + k), ny = Nn.getY(t + k), nz = Nn.getZ(t + k);
    const o = typeof thick === 'function' ? thick(x, y, z) : off;
    pos.push(x + nx * o, y + ny * o, z + nz * o); nor.push(nx, ny, nz);
    const c = colorFn ? colorFn(x, y, z) : [1, 1, 1]; col.push(c[0], c[1], c[2]);
  }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return o;
}

export function buildHead(sp) {
  const skin = sp.skin; const hairC = sp.hair || [0.2, 0.15, 0.1];
  const R = rng((sp.seed || 1) * 977 + 13);
  const shell = headShell(sp);
  const surf = surfaceSampler(shell);
  const zAt = (x, y) => { const p = surf(x, y); return p ? p.z : 0.07; };
  const skinParts = [shell], hairParts = [], beardParts = [], metal = [], cloth = [], dark = [];
  const out = { eyes: [], brows: [], mouth: null };

  /* nose */
  const nz = (y) => zAt(0, y);
  const nlen = 0.5 + 0.5 * (sp.nose ?? 0.5);
  const bridge = [[0, 0.106, nz(0.106) - 0.002], [0, 0.090, nz(0.090) + 0.006], [0, 0.073, nz(0.073) + 0.011 * nlen + 0.004], [0, 0.061, nz(0.061) + 0.014 * nlen + 0.005]];
  skinParts.push(tube(bridge, { radius: (t) => 0.0062 + 0.0045 * t, flat: 0.85, seg: 8, color: vary(skin, 0.01, 1), steps: 10 }));
  const tipz = nz(0.0585) + 0.0125 * nlen + 0.006;
  skinParts.push(xf(sphereG(0.0102, 12, 9, vary(skin, 0.03, 1)), { p: [0, 0.0585, tipz], s: [1.1, 0.9, 1.0] }));
  for (const sx of [-1, 1]) {
    skinParts.push(xf(sphereG(0.0088, 10, 8, vary(skin, 0.0, 1)), { p: [sx * 0.0128, 0.0595, nz(0.0595) + 0.008 * nlen + 0.005], s: [0.95, 1.0, 0.9] }));
    dark.push(xf(sphereG(0.0028, 6, 5, [0.16, 0.08, 0.07]), { p: [sx * 0.0062, 0.0525, tipz - 0.0045], s: [1, 0.8, 1] }));
  }
  /* ears */
  for (const sx of [-1, 1]) {
    const e = xf(sphereG(1, 10, 8, vary(skin, -0.02, 1)), { p: [sx * (RX + 0.0035), CY - 0.01, -0.006], r: [0, sx * 0.28, 0], s: [0.0055, 0.026, 0.0165] });
    skinParts.push(e);
    skinParts.push(xf(sphereG(1, 8, 6, vary(skin, -0.07, 1)), { p: [sx * (RX + 0.0055), CY - 0.012, -0.004], r: [0, sx * 0.28, 0], s: [0.0035, 0.018, 0.0105] }));
  }
  /* eyes (separate meshes so heat-vision can glow) */
  const eyeSep = 0.0335 * (sp.eyeSep ?? 1), eyeY = 0.1015, eyeR = 0.0125 * (sp.eyeSize ?? 1);
  const irisC = sp.iris || [0.25, 0.42, 0.62];
  out.eyeGeo = [];
  for (const sx of [1, -1]) {
    const ez = zAt(sx * eyeSep, eyeY) - eyeR * 0.45;
    const ball = sphereG(eyeR, 16, 12, [0.93, 0.91, 0.88]);
    const iris = xf(new THREE.CircleGeometry(eyeR * 0.54, 18), { p: [0, 0, eyeR * 0.985] }); paint(iris, irisC);
    const pupil = xf(new THREE.CircleGeometry(eyeR * 0.26, 14), { p: [0, 0, eyeR * 0.995 + 0.0002] }); paint(pupil, [0.02, 0.02, 0.03]);
    const ring = xf(new THREE.RingGeometry(eyeR * 0.40, eyeR * 0.54, 18), { p: [0, 0, eyeR * 0.99] }); paint(ring, vary(irisC, -0.12, 1));
    const eg = merge([ball, ring, iris, pupil]);
    xf(eg, { p: [sx * eyeSep, eyeY, ez], r: [0, sx * -0.12, 0] });
    out.eyeGeo.push(eg);
    out.eyes.push({ x: sx * eyeSep, y: eyeY, z: ez, r: eyeR });
    if (sp.lod) continue;
    // lids
    const lidC = vary(skin, -0.02, 1);
    const lidR = eyeR * 1.13;
    const up = new THREE.SphereGeometry(lidR, 14, 8, 0, Math.PI, 0, Math.PI * (0.40 + 0.03 * (sp.lid ?? 0)));
    const lo = new THREE.SphereGeometry(lidR, 14, 4, 0, Math.PI, Math.PI * 0.80, Math.PI * 0.2);
    for (const l of [up, lo]) { xf(l, { r: [0, Math.PI * -0.5 + Math.PI * 0.5, 0] }); }
    // rotate so the half-sphere faces +z: SphereGeometry phi from 0..PI covers +z half when phiStart=0
    const lid = merge([paint(up, lidC), paint(lo, vary(lidC, -0.015, 1))]);
    xf(lid, { p: [sx * eyeSep, eyeY, ez], r: [0, sx * -0.12, 0] }); skinParts.push(lid);
    // upper lash line + crease
    const lash = tube([[sx * (eyeSep - 0.0105), eyeY + 0.001, ez + eyeR * 0.98], [sx * eyeSep, eyeY + 0.0105, ez + eyeR * 1.02], [sx * (eyeSep + 0.0108), eyeY + 0.001, ez + eyeR * 0.98]].map((p) => p), { radius: 0.0011, seg: 4, color: sp.fem ? [0.04, 0.03, 0.03] : mixc(skin, [0.1, 0.06, 0.05], 0.6), steps: 8 });
    dark.push(lash);
  }
  /* brows (pivot meshes, tilted by expression) */
  const browC = vary(hairC, -0.02, 1); const bw = sp.browThick ?? 1;
  for (const sx of [1, -1]) {
    const by = 0.1305 + (sp.browHigh ?? 0) * 0.004; const bz = (x) => zAt(sx * x, by) + 0.0025;
    const pts = [[-0.020, -0.0015, 0], [-0.006, 0.0035, 0], [0.010, 0.0042, 0], [0.026, -0.001, 0]].map(([x, y]) => [x, y, bz(eyeSep + x) - bz(eyeSep)]);
    const g = tube(pts, { radius: (t) => (0.0042 - 0.0018 * t) * bw, flat: 0.5, seg: 6, color: browC, steps: 8 });
    // mirror orientation so the thick end is inner
    if (sx < 0) xf(g, { s: [-1, 1, 1] });
    xf(g, { p: [0, 0, 0] });
    out.brows.push({ geo: g, x: sx * eyeSep, y: by, z: bz(eyeSep), sx });
  }
  if (sp.scars) { const sx = 1; dark.push(tube([[0.062, 0.12, zAt(0.062, 0.12) + 0.001], [0.052, 0.085, zAt(0.052, 0.085) + 0.001], [0.044, 0.055, zAt(0.044, 0.055) + 0.001]], { radius: 0.0012, seg: 4, color: [0.5, 0.2, 0.2], steps: 6 })); dark.push(tube([[0.066, 0.108, zAt(0.066, 0.108) + 0.001], [0.044, 0.1, zAt(0.044, 0.1) + 0.001]], { radius: 0.0009, seg: 4, color: [0.5, 0.2, 0.2], steps: 4 })); }
  /* mouth (dynamic) */
  const my = 0.0375; out.mouth = { y: my, z: zAt(0, my), halfW: 0.0295 * (sp.mouthW ?? 1), lip: mixc(skin, sp.fem ? [0.72, 0.28, 0.32] : [0.62, 0.32, 0.30], sp.fem ? 0.7 : 0.5), fullness: sp.lips ?? 0.5, fem: !!sp.fem };

  /* hair, beard, headwear */
  buildHair(sp, shell, hairParts, R, hairC, zAt);
  buildBeard(sp, shell, beardParts, hairC, skin);
  headwear(sp, shell, cloth, metal, dark, zAt, out);
  out.skin = merge(skinParts);
  out.hair = hairParts.length ? merge(hairParts) : null;
  out.beard = beardParts.length ? merge(beardParts) : null;
  out.cloth = cloth.length ? merge(cloth) : null; out.metal = metal.length ? merge(metal) : null; out.dark = dark.length ? merge(dark) : null;
  out.zAt = zAt;
  return out;
}

/* ---------------- hair ---------------- */
function buildHair(sp, shell, parts, R, hc, zAt) {
  const st = sp.hairStyle || 'short'; if (st === 'none' || st === 'bald' || sp.mask != null || sp.hood) return;
  const hl = (uz) => (0.42 - 0.9 * smoothstep(0.75, -0.25, uz)) * RY;               // hairline height (relative to head centre)
  const inHair = (x, y, z) => { const yr = y - CY; const uz = z / (RZ * 1.0); return yr > hl(uz) && !(st === 'buzz' && false); };
  const side = (sp.part ?? 1);
  const thick = (x, y, z) => { const uy = (y - CY) / RY; const base = st === 'buzz' ? 0.0035 : 0.009; const vol = st === 'buzz' ? 0.0 : (sp.hairVol ?? 1) * 0.017 * smoothstep(0.1, 1, uy); const tex = 0.0022 * Math.sin(x * 160 + z * 130) * Math.sin(y * 150); return base + vol + tex; };
  const colorF = (x, y, z) => { const k = 0.07 * Math.sin(x * 90 + y * 70) * Math.sin(z * 110 - y * 40); return vary(hc, k, 1); };
  parts.push(subsurface(shell, inHair, 0, colorF, thick));
  const lock = (pts, w0, w1, c) => tube(pts, { radius: (t) => w0 + (w1 - w0) * t, flat: 0.55, seg: 6, color: c || vary(hc, 0.03, 1), steps: 10 });
  const rib = (pts, w, side, curl) => ribbon(pts, { width: typeof w === 'function' ? w : () => w, side, curl, steps: 14, color: vary(hc, 0.0, 1), colorFn: (t, k) => vary(hc, 0.05 * (1 - Math.abs(k)) - 0.04 * t, 1) });
  if (st === 'side' || st === 'swept') { // neat swept fringe (Homelander)
    for (let i = 0; i < 7; i++) {
      const u = i / 6, x0 = (-0.045 + 0.075 * u) * side, z0 = 0.035 + 0.02 * (1 - Math.abs(u - 0.5) * 2);
      parts.push(lock([[x0, CY + 0.088, z0], [x0 + 0.012 * side, CY + 0.098, z0 + 0.03], [x0 + 0.04 * side, CY + 0.082, z0 + 0.052], [x0 + 0.062 * side, CY + 0.056, z0 + 0.044]], 0.0052, 0.0014, vary(hc, 0.03 * (u - 0.5), 1)));
    }
    parts.push(lock([[0.055 * side, CY + 0.07, 0.02], [0.076 * side, CY + 0.045, 0.01], [0.082 * side, CY + 0.012, -0.012]], 0.007, 0.003));  // side-burn mass
  } else if (st === 'messy') {
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, e = 0.25 + R() * 0.7; const dx = Math.cos(a) * Math.cos(e), dz = Math.sin(a) * Math.cos(e), dy = Math.sin(e);
      if (dz > 0.5 && dy < 0.35) continue;
      const p0 = [dx * RX * 0.92, CY + dy * RY * 0.95, dz * RZ * 0.92], L = 0.03 + R() * 0.03;
      parts.push(lock([p0, [p0[0] + dx * L * 0.5, p0[1] + dy * L * 0.5 + 0.004, p0[2] + dz * L * 0.5], [p0[0] + dx * L + (R() - 0.5) * 0.02, p0[1] + dy * L * 0.9 - 0.004, p0[2] + dz * L + (R() - 0.5) * 0.02]], 0.0052, 0.0006));
    }
    for (let i = 0; i < 5; i++) { const x = -0.04 + i * 0.02; parts.push(lock([[x, CY + 0.085, 0.045], [x + 0.004, CY + 0.088, 0.075], [x + (R() - 0.5) * 0.02, CY + 0.068 - R() * 0.02, 0.092]], 0.0048, 0.0008)); }
  } else if (st === 'long') {
    const back = (x, w, len, curl) => rib([[x, CY + 0.075, -0.045], [x * 1.12, CY + 0.02, -0.088], [x * 1.18, CY - 0.07, -0.1 - curl * 0.5], [x * 1.12, CY - 0.17, -0.09 - curl], [x * 1.05, CY - 0.22 - len, -0.075 - curl * 1.2]], w, [1, 0, 0], 0.006);
    [-0.05, -0.03, -0.01, 0.01, 0.03, 0.05].forEach((x, i) => parts.push(back(x, (t) => 0.036 * (1 - 0.35 * t), 0.03 + (i % 3) * 0.015, 0.012 * (i % 2 ? 1 : -1))));
    for (const sx of [-1, 1]) {
      parts.push(rib([[sx * 0.058, CY + 0.07, 0.03], [sx * 0.084, CY + 0.03, 0.008], [sx * 0.088, CY - 0.05, -0.005], [sx * 0.082, CY - 0.15, 0.0], [sx * 0.074, CY - 0.235, 0.012]], (t) => 0.034 * (1 - 0.4 * t), [0, 0, 1], 0.005));
      parts.push(rib([[sx * 0.036, CY + 0.086, 0.07], [sx * 0.072, CY + 0.052, 0.05], [sx * 0.09, CY - 0.0, 0.03], [sx * 0.092, CY - 0.1, 0.03], [sx * 0.086, CY - 0.18, 0.04]], (t) => 0.028 * (1 - 0.5 * t), [0, 0, 1], 0.004));
    }
    // fringe sweep across forehead
    for (let i = 0; i < 4; i++) parts.push(lock([[0.01 * (i - 1.5), CY + 0.09, 0.04], [0.02 * (i - 1.5) * side + 0.01, CY + 0.098, 0.075], [0.044 * (i - 1.2) * side, CY + 0.07, 0.088], [0.066 * side * (1 + i * 0.15), CY + 0.035, 0.07]], 0.0058, 0.0012));
  } else if (st === 'bob') {
    const rings = []; for (let i = 0; i <= 9; i++) { const t = i / 9; const y = CY + 0.078 - t * 0.138; rings.push({ y, rx: RX + 0.012 + 0.008 * Math.sin(t * 2.4), rz: RZ + 0.014 + 0.01 * Math.sin(t * 2.2), cz: -0.008, n: 2.4 }); }
    let g = loft(rings, { seg: 28, color: hc, capTop: false, capBottom: false, colorFn: (t, a) => vary(hc, 0.05 * (1 - t) - 0.03 * Math.sin(a * 9), 1) });
    g = g.toNonIndexed(); const P = g.attributes.position; const keep = [];
    for (let t = 0; t < P.count; t += 3) { let cx = 0, cy = 0, cz = 0; for (let k = 0; k < 3; k++) { cx += P.getX(t + k); cy += P.getY(t + k); cz += P.getZ(t + k); } cx /= 3; cy /= 3; cz /= 3; if (cz > 0.015 && Math.abs(cx) < 0.062 && cy < CY + 0.052) continue; keep.push(t); }
    const pos = [], col = []; const C = g.attributes.color; for (const t of keep) for (let k = 0; k < 3; k++) { pos.push(P.getX(t + k), P.getY(t + k), P.getZ(t + k)); col.push(C.getX(t + k), C.getY(t + k), C.getZ(t + k)); }
    const og = new THREE.BufferGeometry(); og.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); og.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); og.computeVertexNormals(); parts.push(og);
    for (let i = 0; i < 5; i++) { const u = i / 4; parts.push(lock([[(u - 0.5) * 0.09, CY + 0.092, 0.04], [(u - 0.5) * 0.11 + 0.01 * side, CY + 0.098, 0.08], [(u - 0.5) * 0.14 + 0.02 * side, CY + 0.066, 0.1]], 0.006, 0.0015)); }
  } else if (st === 'short') {
    for (let i = 0; i < 6; i++) { const u = i / 5; parts.push(lock([[(u - 0.5) * 0.09, CY + 0.088, 0.035], [(u - 0.5) * 0.1, CY + 0.098, 0.07], [(u - 0.5) * 0.11 + 0.012 * side, CY + 0.082, 0.09]], 0.0055, 0.001)); }
  }
}

/* ---------------- facial hair ---------------- */
function buildBeard(sp, shell, parts, hc, skin) {
  const b = sp.beard; if (!b || b === 'none') return;
  const mouthZone = (x, y, z) => Math.abs(x) < 0.036 && y > 0.026 && y < 0.05 && z > 0.05;
  const yrel = (y) => (y - CY) / RY;
  const bc = b === 'stubble' ? mixc(skin, hc, 0.62) : vary(sp.beardColor || hc, 0, 1);
  const cf = (x, y, z) => vary(bc, 0.05 * Math.sin(x * 140 + y * 110 + z * 90), 1);
  let pred, off;
  if (b === 'stubble') { pred = (x, y, z) => yrel(y) < -0.18 && z > -0.02 && !mouthZone(x, y, z); off = 0.0014; }
  else if (b === 'full') { pred = (x, y, z) => yrel(y) < -0.16 && z > -0.04 && !(Math.abs(x) < 0.034 && y > 0.026 && y < 0.049 && z > 0.05); off = 0.0075; }
  else if (b === 'goatee') { pred = (x, y, z) => yrel(y) < -0.55 && Math.abs(x) < 0.04 && z > 0.02; off = 0.007; }
  else { pred = () => false; off = 0; }
  if (b !== 'mustache') parts.push(subsurface(shell, pred, off, cf, off));
  if (b === 'full' || b === 'goatee' || b === 'mustache' || b === 'stubble') {
    const z0 = surfaceSampler(shell)(0, 0.052, 0.5) ; const zc = z0 ? z0.z : 0.085;
    parts.push(tube([[-0.03, 0.038, zc - 0.016], [-0.014, 0.0495, zc + 0.002], [0, 0.0475, zc + 0.003], [0.014, 0.0495, zc + 0.002], [0.03, 0.038, zc - 0.016]], { radius: b === 'stubble' ? 0.0028 : 0.0052, flat: 0.8, seg: 6, color: vary(bc, -0.02, 1), steps: 12 }));
  }
  if (b === 'goatee') parts.push(tube([[0, 0.012, 0.075], [0, -0.004, 0.078], [0, -0.016, 0.07]], { radius: (t) => 0.007 * (1 - 0.5 * t), seg: 6, color: bc }));
}

/* ---------------- masks, helmets, glasses, tiara ---------------- */
function headwear(sp, shell, cloth, metal, dark, zAt, out) {
  if (sp.mask != null) { // full-head hood with eye openings (skin visible through slits)
    const mc = sp.mask;
    const eyeOpen = (x, y, z) => { for (const sx of [-1, 1]) { const dx = x - sx * 0.0335, dy = y - 0.1015; if (z > 0.03 && (dx * dx) / (0.021 * 0.021) + (dy * dy) / (0.0095 * 0.0095) < 1) return true; } return false; };
    cloth.push(subsurface(shell, (x, y, z) => !eyeOpen(x, y, z) && y > 0.0 - 0.0 && !(y < 0.01), 0.0042, (x, y, z) => vary(mc, 0.025 * Math.sin(x * 160) * Math.sin(y * 150), 1), 0.0042));
    // brow/forehead plate & mouth grille
    metal.push(xf(boxG(0.066, 0.006, 0.01, [0.1, 0.1, 0.11]), { p: [0, 0.128, zAt(0, 0.128) + 0.006], r: [-0.15, 0, 0] }));
    for (let i = -2; i <= 2; i++) dark.push(xf(boxG(0.0025, 0.016, 0.003, [0.02, 0.02, 0.02]), { p: [i * 0.007, 0.034, zAt(i * 0.007, 0.034) + 0.006] }));
  }
  if (sp.helmet) {
    const hcol = sp.helmet;
    const rings = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const a = t * Math.PI * 0.5; rings.push({ y: CY + 0.045 + Math.sin(a) * (RY + 0.018), rx: (RX + 0.014) * Math.cos(a) + 0.0001, rz: (RZ + 0.016) * Math.cos(a) + 0.0001, cz: -0.004, n: 2 }); }
    cloth.push(loft(rings, { seg: 28, capBottom: false, color: hcol, colorFn: (t, a) => vary(hcol, 0.03 * Math.sin(a * 11) - 0.03 * t, 1) }));
    const brim = []; for (let i = 0; i < 2; i++) brim.push({ y: CY + 0.044 - i * 0.012, rx: RX + 0.03 - i * 0.008, rz: RZ + 0.034 - i * 0.008, cz: 0.0, n: 2.2 });
    cloth.push(loft(brim, { seg: 28, color: vary(hcol, -0.04, 1) }));
    metal.push(tube([[RX + 0.002, CY + 0.02, 0.02], [RX - 0.004, CY - 0.05, 0.03], [0.04, 0.005, 0.07], [0.0, -0.012, 0.085]], { radius: 0.0022, seg: 4, color: [0.28, 0.24, 0.18] }));
    metal.push(tube([[-RX - 0.002, CY + 0.02, 0.02], [-RX + 0.004, CY - 0.05, 0.03], [-0.04, 0.005, 0.07], [0.0, -0.012, 0.085]], { radius: 0.0022, seg: 4, color: [0.28, 0.24, 0.18] }));
    if (sp.helmetStar) metal.push(xf(sphereG(0.012, 8, 6, [0.92, 0.92, 0.95]), { p: [0, CY + 0.075, RZ + 0.012], s: [1, 1, 0.3] }));
  }
  if (sp.glasses) {
    const c = [0.06, 0.06, 0.07];
    for (const sx of [-1, 1]) {
      const z = zAt(sx * 0.0335, 0.1015) + 0.009;
      metal.push(xf(new THREE.TorusGeometry(0.0155, 0.0013, 6, 22), { p: [sx * 0.0335, 0.1015, z] })); paint(metal[metal.length - 1], c);
      metal.push(paint(tube([[sx * 0.0495, 0.103, z - 0.002], [sx * 0.08, 0.105, z - 0.04], [sx * 0.082, 0.095, -0.02]], { radius: 0.0011, seg: 4, color: c }), c));
      dark.push(xf(new THREE.CircleGeometry(0.0145, 18), { p: [sx * 0.0335, 0.1015, z - 0.0005] }));
      paint(dark[dark.length - 1], [0.12, 0.16, 0.2]);
    }
    metal.push(paint(tube([[-0.0185, 0.104, zAt(0, 0.104) + 0.012], [0, 0.106, zAt(0, 0.106) + 0.014], [0.0185, 0.104, zAt(0, 0.104) + 0.012]], { radius: 0.0011, seg: 4, color: c }), c));
  }
  if (sp.tiara) {
    metal.push(tube([[-RX + 0.004, CY + 0.03, 0.03], [-0.05, CY + 0.088, 0.045], [0, CY + 0.1, 0.062], [0.05, CY + 0.088, 0.045], [RX - 0.004, CY + 0.03, 0.03]], { radius: 0.0022, flat: 1.2, seg: 6, color: [0.82, 0.82, 0.88], steps: 20 }));
    metal.push(xf(new THREE.ConeGeometry(0.004, 0.018, 5), { p: [0, CY + 0.114, 0.064] })); paint(metal[metal.length - 1], [0.86, 0.86, 0.92]);
    metal.push(xf(sphereG(0.004, 8, 6, [0.4, 0.7, 1.0]), { p: [0, CY + 0.101, 0.07] }));
  }
}
