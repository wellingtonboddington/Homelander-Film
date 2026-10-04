import * as THREE from 'three';
import { loft, tube, ribbon, merge, paint, xf, sphereG, boxG, cylG, mixc, smoothstep, relief } from './geo.js';

export const DIM = { KNEE: 0.45, SHIN: 0.40, FOOT_H: 0.08, ELBOW: 0.30, FORE: 0.29, HIP_Y: -0.04, SH_Y: 0.52, NECK_Y: 0.60, SPINE_Y: 0.08 };
const P = Math.PI;
const lerp = (a, b, t) => a + (b - a) * t;
export function prof(keys, y) { // keys: [[y, rx, rz, cz?]] sorted in descending or ascending y
  const asc = keys[0][0] < keys[keys.length - 1][0]; const k = asc ? keys : keys.slice().reverse();
  if (y <= k[0][0]) return { rx: k[0][1], rz: k[0][2], cz: k[0][3] || 0 };
  for (let i = 0; i < k.length - 1; i++) if (y <= k[i + 1][0]) { const t = (y - k[i][0]) / (k[i + 1][0] - k[i][0]); const s = t * t * (3 - 2 * t) * 0.35 + t * 0.65; return { rx: lerp(k[i][1], k[i + 1][1], s), rz: lerp(k[i][2], k[i + 1][2], s), cz: lerp(k[i][3] || 0, k[i + 1][3] || 0, s) }; }
  const e = k[k.length - 1]; return { rx: e[1], rz: e[2], cz: e[3] || 0 };
}
const ringsOf = (keys, y0, y1, n, off = 0, bump, nexp = 2) => { const out = []; for (let i = 0; i < n; i++) { const y = lerp(y0, y1, i / (n - 1)); const p = prof(keys, y); out.push({ y, rx: p.rx + off, rz: p.rz + off, cz: p.cz, n: nexp, f: bump ? (a) => bump(y, a) : null }); } return out; };
const G = (x, w) => Math.exp(-(x * x) / (w * w));
const ang = (a, c) => { let d = a - c; while (d > P) d -= 2 * P; while (d < -P) d += 2 * P; return d; };

/* ---------- torso profile (spine-bone space; y=0 waist, y=0.6 neck base) ---------- */
export function torsoKeys(sp) {
  const b = sp.bulk || 1, sw = sp.shoulder || 1, f = sp.fem ? 1 : 0;
  return [
    [-0.10, 0.145 * b + 0.01 * f, 0.098 * b], [-0.03, 0.140 * b - 0.012 * f, 0.094 * b - 0.006 * f], [0.04, 0.146 * b - 0.016 * f, 0.098 * b - 0.008 * f], [0.12, 0.158 * b - 0.01 * f, 0.106 * b],
    [0.22, 0.178 * b * (1 - 0.06 * f), 0.118 * b], [0.33, 0.199 * b * sw * (1 - 0.1 * f), 0.128 * b + 0.01 * f], [0.43, 0.212 * b * sw * (1 - 0.14 * f), 0.121 * b], [0.51, 0.200 * b * sw * (1 - 0.14 * f), 0.104 * b],
    [0.565, 0.130 * (b * 0.7 + 0.3), 0.084], [0.615, 0.062, 0.058], [0.64, 0.054, 0.054],
  ];
}
function torsoBump(sp) {
  const m = (sp.muscle ?? 0.6) * (sp.bulk > 1.1 ? 1.15 : 1), f = sp.fem ? 1 : 0;
  return (y, a) => {
    let k = 1;
    const pec = G(y - 0.35, 0.075);
    k += (0.095 * m * (1 - 0.6 * f) + 0.075 * f) * pec * (G(ang(a, 1.0), 0.5) + G(ang(a, 2.14), 0.5));
    k -= 0.035 * m * pec * G(ang(a, P / 2), 0.11);
    const abs = G(ang(a, P / 2), 0.55) * smoothstep(-0.02, 0.05, y) * (1 - smoothstep(0.17, 0.24, y));
    k += 0.011 * m * (1 - f) * abs * (0.5 + 0.5 * Math.cos((y + 0.01) * P / 0.0525)) - 0.007 * m * abs * G(ang(a, P / 2), 0.05);
    k += 0.07 * m * G(y - 0.32, 0.12) * (G(ang(a, 0), 0.75) + G(ang(a, P), 0.75));          // lats
    k += 0.06 * m * G(y - 0.54, 0.07) * G(ang(a, -P / 2), 0.9);                             // trapezius
    k += 0.03 * m * G(y - 0.38, 0.09) * G(ang(a, -P / 2), 0.7) * (1 + Math.cos(ang(a, -P / 2) * 7) * 0.4); // back
    return k;
  };
}
export const torsoSurf = (sp, y, a = P / 2) => { const p = prof(torsoKeys(sp), y); const k = torsoBump(sp)(y, a); return { z: p.rz * k, x: p.rx * k }; };

/* ---------- build ---------- */
export function buildBody(sp) {
  const sg = (n) => (sp.lod ? Math.max(10, Math.round(n * 0.58)) : n);
  const b = sp.bulk || 1, f = sp.fem ? 1 : 0, mus = sp.muscle ?? 0.6;
  const skin = sp.skin;
  const B = {}; const add = (bone, kind, g) => { if (!g) return; ((B[bone] = B[bone] || {})[kind] = B[bone][kind] || []).push(g); };
  const clothC = sp.suit || [0.2, 0.2, 0.3], pantsC = sp.pants || clothC, bootC = sp.boot || [0.1, 0.1, 0.1], gloveC = sp.glove, slvC = sp.sleeve || clothC, foreC = sp.fore || slvC;

  /* neck */
  { const keys = [[-0.03, 0.054, 0.052], [0.04, 0.047, 0.047], [0.1, 0.043, 0.046]]; const r = ringsOf(keys, -0.03, 0.1, 6, 0, (y, a) => 1 + 0.07 * mus * G(ang(a, P / 2 + 0.7), 0.35) + 0.07 * mus * G(ang(a, P / 2 - 0.7), 0.35));
    add('neck', 'skin', loft(r, { seg: sg(18), color: skin })); }
  /* torso skin */
  const tk = torsoKeys(sp); const tb = torsoBump(sp);
  const tr = ringsOf(tk, -0.10, 0.64, 26, 0, tb, 2.25);
  add('spine', 'skin', loft(tr, { seg: sg(32), color: skin, capBottom: false }));
  /* torso cloth shell (full coverage from waist to collar; V/open neck handled by sp.neckline) */
  const covTop = sp.coverTop ?? 0.575; const nl = sp.neckline || 'crew';
  const cloth = ringsOf(tk, -0.095, covTop, 22, 0.0045, (y, a) => tb(y, a) * (1 + 0.012 * Math.sin(y * 70 + a * 3) * (sp.fold ?? 0.6)), 2.25);
  add('spine', 'cloth', loft(cloth, { seg: sg(32), color: clothC, capBottom: false, capTop: false,
    colorFn: (t, a, i, p) => { const y = p[1]; let c = clothC; if (sp.torsoColor) c = sp.torsoColor(y, a, p) || c; return c; } }));
  if (nl === 'vneck' || nl === 'open') add('spine', 'skin', xf(sphereG(1, 14, 10, skin), { p: [0, 0.545, torsoSurf(sp, 0.545).z - 0.012], s: [0.05, 0.08, 0.02] }));
  /* pelvis */
  { const pk = [[-0.16, 0.130 * b + 0.012 * f, 0.092 * b], [-0.08, 0.152 * b + 0.026 * f, 0.108 * b + 0.006 * f], [0.0, 0.158 * b + 0.024 * f, 0.108 * b], [0.09, 0.146 * b + 0.01 * f, 0.1 * b]];
    const pb = (y, a) => 1 + 0.045 * mus * G(ang(a, -P / 2), 0.55) * G(y + 0.04, 0.09) + 0.02 * f * (G(ang(a, 0), 0.5) + G(ang(a, P), 0.5));
    add('root', 'skin', loft(ringsOf(pk, -0.16, 0.09, 12, 0, pb, 2.3), { seg: sg(28), color: skin }));
    add('root', 'cloth', loft(ringsOf(pk, -0.15, 0.09, 12, 0.0045, pb, 2.3), { seg: sg(28), color: pantsC, capTop: false })); }

  /* ----- limbs (build left, mirror for right via sx) ----- */
  for (const sx of [1, -1]) {
    const S = sx > 0 ? 'L' : 'R';
    // upper arm (shoulder frame; hangs down -y; outer = sx)
    const uk = [[0.03, 0.066 * b, 0.064 * b], [-0.03, 0.064 * b + 0.002, 0.062 * b], [-0.12, 0.055 * b, 0.057 * b], [-0.22, 0.047 * b, 0.049 * b], [-0.30, 0.041, 0.043]];
    const ub = (y, a) => 1 + 0.12 * mus * G(y + 0.02, 0.06) * G(ang(a, sx > 0 ? 0.3 : P - 0.3), 1.0) + 0.10 * mus * G(y + 0.11, 0.07) * G(ang(a, P / 2), 0.7) + 0.07 * mus * G(y + 0.12, 0.08) * G(ang(a, -P / 2), 0.8);
    add('sh' + S, 'skin', loft(ringsOf(uk, 0.03, -0.30, 12, 0, ub), { seg: sg(18), color: skin, capTop: true }));
    const sleeveEnd = sp.sleeveEnd ?? -0.30; // 0 none ... -0.30 full
    if (sleeveEnd < -0.03) add('sh' + S, 'cloth', loft(ringsOf(uk, 0.035, sleeveEnd, 12, 0.0042, ub), { seg: sg(18), color: slvC, capBottom: false }));
    add('sh' + S, 'skin', xf(sphereG(0.062 * b, 14, 10, skin), { p: [0, 0, 0], s: [1, 1, 1] }));
    // forearm + hand (elbow frame)
    const fk = [[0.0, 0.044, 0.045], [-0.07, 0.050, 0.050], [-0.17, 0.042, 0.041], [-0.29, 0.029, 0.027]];
    const fb = (y, a) => 1 + 0.12 * mus * G(y + 0.06, 0.07) * G(ang(a, sx > 0 ? 0.3 : P - 0.3), 1.1) + 0.05 * mus * G(y + 0.1, 0.1) * G(ang(a, P / 2), 0.8);
    add('el' + S, 'skin', loft(ringsOf(fk, 0.0, -0.29, 10, 0, fb), { seg: sg(16), color: skin, capTop: true }));
    const foreEnd = sp.foreEnd ?? -0.29; const foreStart = sp.foreStart ?? 0.0;
    if (foreEnd < foreStart - 0.02) add('el' + S, 'cloth', loft(ringsOf(fk, foreStart, foreEnd, 10, 0.004, fb), { seg: sg(16), color: foreC, capTop: false, capBottom: false }));
    add('el' + S, 'skin', xf(sphereG(0.045, 12, 8, skin), { p: [0, 0, 0] }));
    // hand
    const hc = gloveC || skin; const hk = gloveC ? 'cloth' : 'skin'; const hs = gloveC ? 0.0025 : 0;
    const palm = loft([{ y: -0.285, rx: 0.026 + hs, rz: 0.017 + hs }, { y: -0.31, rx: 0.037 + hs, rz: 0.021 + hs }, { y: -0.345, rx: 0.039 + hs, rz: 0.020 + hs }, { y: -0.372, rx: 0.036 + hs, rz: 0.016 + hs, n: 2.4 }], { seg: sg(14), color: hc, capBottom: true });
    add('el' + S, hk, palm);
    const fingers = [[-0.0285, 0.039, 1.0], [-0.0095, 0.042, 1.07], [0.0095, 0.0405, 1.0], [0.0285, 0.035, 0.88]];
    if (!sp.lod) fingers.forEach(([fx, ln, cl], i) => {
      const X = fx * sx, y0 = -0.368, L = ln * cl; const curl = sp.fist ? 0.9 : 0.5 + 0.12 * i;
      add('el' + S, hk, tube([[X, y0, 0.003], [X * 1.02, y0 - L * 0.5, 0.006 + 0.016 * curl], [X * 1.02, y0 - L * 0.85, 0.016 + 0.034 * curl], [X * 1.0, y0 - L * 0.95 + 0.006 * curl, 0.022 + 0.046 * curl]], { radius: (t) => 0.0078 - 0.0025 * t + hs, seg: sg(6), color: hc, steps: 8 }));
    });
    if (!sp.lod) add('el' + S, hk, tube([[0.02 * -sx, -0.318, 0.012], [0.034 * -sx, -0.345, 0.026], [0.04 * -sx, -0.372, 0.04], [0.036 * -sx, -0.392, 0.048]], { radius: (t) => 0.0098 - 0.003 * t + hs, seg: sg(6), color: hc, steps: 7 }));
    if (gloveC) add('el' + S, 'cloth', loft([{ y: -0.245, rx: 0.036, rz: 0.035 }, { y: -0.285, rx: 0.037, rz: 0.034 }], { seg: sg(14), color: mixc(gloveC, [0, 0, 0], 0.18), capTop: false, capBottom: false }));

    // leg (hip frame)
    const tkeys = [[0.045, 0.098 * b, 0.1 * b], [-0.05, 0.092 * b, 0.095 * b], [-0.18, 0.082 * b, 0.082 * b], [-0.33, 0.066 * b, 0.066 * b], [-0.45, 0.050, 0.052]];
    const tbump = (y, a) => 1 + 0.10 * mus * G(y + 0.17, 0.12) * G(ang(a, P / 2 + (sx > 0 ? -0.35 : 0.35)), 0.8) + 0.07 * mus * G(y + 0.15, 0.12) * G(ang(a, -P / 2), 0.8) + 0.05 * mus * G(y + 0.33, 0.06) * G(ang(a, sx > 0 ? 0.3 : P - 0.3), 0.8);
    add('hp' + S, 'skin', loft(ringsOf(tkeys, 0.045, -0.45, 14, 0, tbump), { seg: sg(20), color: skin, capTop: true }));
    add('hp' + S, 'cloth', loft(ringsOf(tkeys, 0.04, -0.445, 14, 0.0045, (y, a) => tbump(y, a) * (1 + 0.012 * Math.sin(y * 55 + a * 2) * (sp.fold ?? 0.6))), { seg: sg(20), color: pantsC, capTop: true }));
    // shin + boot
    const skeys = [[0.0, 0.051, 0.052], [-0.10, 0.052, 0.058, -0.004], [-0.22, 0.042, 0.043], [-0.34, 0.034, 0.034], [-0.40, 0.032, 0.033]];
    const sb = (y, a) => 1 + 0.12 * mus * G(y + 0.10, 0.07) * G(ang(a, -P / 2), 0.9) + 0.04 * G(y + 0.12, 0.1) * G(ang(a, P / 2), 0.4);
    add('kn' + S, 'skin', loft(ringsOf(skeys, 0.0, -0.40, 12, 0, sb), { seg: sg(18), color: skin, capTop: true }));
    const shinC = sp.shin || pantsC;
    add('kn' + S, 'cloth', loft(ringsOf(skeys, -0.004, -0.40, 12, 0.0042, sb), { seg: sg(18), color: shinC, capTop: false }));
    add('kn' + S, 'skin', xf(sphereG(0.05, 12, 8, skin), { p: [0, 0, 0.002] }));
    // boot / shoe shell
    const bh = sp.bootH ?? 0.62; // fraction of shin covered
    const topY = -0.40 + 0.40 * bh;
    const bootRings = [];
    const bk = [[topY, 0.047, 0.05], [-0.28, 0.043, 0.046], [-0.34, 0.040, 0.042]];
    for (let i = 0; i < 6; i++) { const y = lerp(topY, -0.35, i / 5); const p = prof(bk, y); bootRings.push({ y, rx: p.rx + 0.003, rz: p.rz + 0.003, cz: 0.002, n: 2 }); }
    add('kn' + S, 'cloth', loft(bootRings, { seg: sg(18), color: bootC, capTop: false, capBottom: false }));
    const fr = [{ y: -0.335, rx: 0.042, rz: 0.044, cz: 0.0 }, { y: -0.375, rx: 0.045, rz: 0.062, cz: 0.012 }, { y: -0.405, rx: 0.047, rz: 0.090, cz: 0.034 }, { y: -0.43, rx: 0.048, rz: 0.108, cz: 0.044 }, { y: -0.462, rx: 0.049, rz: 0.114, cz: 0.047, n: 2.5 }];
    add('kn' + S, 'cloth', loft(fr, { seg: sg(20), color: bootC, capBottom: true, capTop: false }));
    add('kn' + S, 'cloth', loft([{ y: -0.462, rx: 0.052, rz: 0.12, cz: 0.047, n: 3 }, { y: -0.4, rx: 0.052, rz: 0.12, cz: 0.047, n: 3 }].map((r, i) => ({ ...r, y: -0.462 - 0.0 + i * 0.0 + (i ? 0.018 : 0) })), { seg: sg(20), color: mixc(bootC, [0, 0, 0], 0.5) }));
    add('kn' + S, 'cloth', xf(sphereG(0.033, 10, 8, bootC), { p: [0, -0.43, 0.115], s: [1.2, 0.8, 1.0] }));
    add('kn' + S, 'cloth', xf(cylG(0.032, 0.036, 0.04, 10, mixc(bootC, [0, 0, 0], 0.55)), { p: [0, -0.46, -0.04] }));
  }
  return B;
}

export const costumeHelpers = { relief, tube, ribbon, loft, xf, sphereG, boxG, cylG, paint, mixc, torsoSurf, prof };
