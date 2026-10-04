import * as THREE from 'three';
import { loft, tube, ribbon, relief, paint, xf, sphereG, boxG, cylG, mixc, hexRGB, merge } from './geo.js';
import { prof, torsoSurf, torsoKeys } from './body.js';

export const CAPE_PROFILES = { hero: { w: 0.52, len: 1.62, z: -0.115, y: 0.575 }, short: { w: 0.46, len: 0.9, z: -0.11, y: 0.57 }, noir: { w: 0.5, len: 1.1, z: -0.115, y: 0.575 } };
const GOLD = [0.86, 0.66, 0.2], GOLDD = [0.62, 0.45, 0.12], SILV = [0.8, 0.82, 0.88], WHITE = [0.9, 0.9, 0.92], RED = [0.72, 0.1, 0.14], BLUE = [0.1, 0.18, 0.5];
export const col = hexRGB;
const P = Math.PI;

/* emblem polygons (unit ~1 wide, y up) */
export const EAGLE = [[0, 0.5], [0.05, 0.38], [0.14, 0.34], [0.3, 0.42], [0.48, 0.36], [0.52, 0.26], [0.42, 0.2], [0.5, 0.1], [0.4, 0.04], [0.44, -0.06], [0.3, -0.04], [0.2, -0.14], [0.1, -0.12], [0.06, -0.3], [0.13, -0.5], [0.0, -0.44], [-0.13, -0.5], [-0.06, -0.3], [-0.1, -0.12], [-0.2, -0.14], [-0.3, -0.04], [-0.44, -0.06], [-0.4, 0.04], [-0.5, 0.1], [-0.42, 0.2], [-0.52, 0.26], [-0.48, 0.36], [-0.3, 0.42], [-0.14, 0.34], [-0.05, 0.38]];
export const STAR = (() => { const p = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.2 : 0.5; const a = P / 2 + (i * P) / 5; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return p; })();
export const BOLT = [[0.1, 0.5], [-0.28, -0.02], [-0.04, -0.02], [-0.16, -0.5], [0.3, 0.1], [0.04, 0.1]];
export const FIN = [[0, 0.5], [0.22, 0.12], [0.5, -0.1], [0.2, -0.05], [0.3, -0.5], [0, -0.22], [-0.3, -0.5], [-0.2, -0.05], [-0.5, -0.1], [-0.22, 0.12]];

/* wrap a flat relief onto the torso front: x,y -> surface z */
export function wrap(g, sp, yc, scale = 1) {
  const Pp = g.attributes.position;
  for (let i = 0; i < Pp.count; i++) {
    const x = Pp.getX(i), y = Pp.getY(i) + yc, z0 = Pp.getZ(i);
    const t = prof(torsoKeys(sp), y); const k = Math.min(0.97, Math.abs(x) / t.rx);
    const a = Math.atan2(Math.sqrt(Math.max(0, 1 - k * k)) * 1, x / t.rx);
    const surf = torsoSurf(sp, y, a > 0 ? Math.acos(Math.max(-1, Math.min(1, x / t.rx))) : P / 2);
    const zs = t.rz * Math.pow(Math.max(0.0001, 1 - Math.pow(k, 2.25)), 1 / 2.25) * (surf.z / t.rz);
    Pp.setXYZ(i, x, y, zs + z0 + 0.003);
  }
  g.computeVertexNormals(); return g;
}
const emblem = (ctx, poly, y, w, color, depth = 0.012) => { const g = relief(poly, depth, 0.0016, color, w); return wrap(g, ctx.sp, y); };
const beltRing = (ctx, y0, h, color, off = 0.01) => { const T = torsoKeys(ctx.sp); const rings = []; for (let i = 0; i < 3; i++) { const y = y0 + (h * i) / 2; const p = prof(T, y); rings.push({ y, rx: p.rx + off, rz: p.rz + off, n: 2.25 }); } return loft(rings, { seg: 32, color, capTop: false, capBottom: false }); };
const hangFringe = (x, y, z, n, len, c) => { const out = []; for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5; out.push(tube([[x + u * 0.05, y, z + u * 0.01], [x + u * 0.056, y - len * 0.6, z + u * 0.012], [x + u * 0.058, y - len, z + u * 0.012]], { radius: 0.0016, seg: 4, color: c, steps: 4 })); } return out; };

/* ====== character costume extras: add(bone, kind, geo) ====== */
export const EXTRA = {
  homelander(ctx) {
    const { sp, add, T } = ctx;
    add('spine', 'metal', emblem(ctx, EAGLE, 0.385, 0.25, GOLD, 0.009));
    add('spine', 'metal', beltRing(ctx, -0.005, 0.05, GOLD, 0.0085)); add('spine', 'metal', xf(boxG(0.06, 0.044, 0.014, GOLD), { p: [0, 0.02, T(0.02).z + 0.011] }));
    add('spine', 'metal', xf(sphereG(0.0075, 8, 6, GOLDD), { p: [0, 0.02, T(0.02).z + 0.02] }));
    // collar + cape clasps/chain
    const tk = torsoKeys(sp); const p5 = prof(tk, 0.585);
    add('spine', 'metal', loft([{ y: 0.57, rx: p5.rx * 0.78, rz: 0.07 }, { y: 0.6, rx: 0.07, rz: 0.066 }, { y: 0.635, rx: 0.062, rz: 0.058 }], { seg: 24, color: GOLD, capTop: false, capBottom: false }));
    for (const sx of [-1, 1]) {
      const px = sx * 0.145;
      add('spine', 'metal', xf(sphereG(0.0105, 10, 8, GOLD), { p: [px, 0.545, T(0.545).z * 0.82], s: [1, 1, 0.6] }));
      // epaulette
      add('spine', 'metal', xf(sphereG(1, 14, 10, GOLD), { p: [sx * (prof(tk, 0.5).rx + 0.05), 0.575, 0], r: [0, 0, sx * -0.32], s: [0.062, 0.02, 0.058] }));
      add('spine', 'metal', xf(sphereG(1, 10, 8, GOLDD), { p: [sx * (prof(tk, 0.5).rx + 0.056), 0.586, 0], r: [0, 0, sx * -0.32], s: [0.036, 0.01, 0.03] }));
      hangFringe(sx * (prof(tk, 0.5).rx + 0.085), 0.565, 0.0, 9, 0.05, GOLDD).forEach((g) => add('spine', 'metal', g));
    }
    add('spine', 'metal', tube([[-0.145, 0.545, T(0.545).z * 0.82 + 0.006], [-0.06, 0.505, T(0.5).z + 0.012], [0.06, 0.505, T(0.5).z + 0.012], [0.145, 0.545, T(0.545).z * 0.82 + 0.006]], { radius: 0.0022, seg: 4, color: GOLDD, steps: 14 }));
    // boot cuffs + glove cuffs
    for (const S of ['L', 'R']) {
      add('kn' + S, 'metal', loft([{ y: -0.24, rx: 0.0485, rz: 0.0525 }, { y: -0.215, rx: 0.0488, rz: 0.0528 }], { seg: 18, color: GOLD, capTop: false, capBottom: false }));
      add('kn' + S, 'cloth', loft([{ y: -0.40, rx: 0.036, rz: 0.04, cz: 0.0 }, { y: -0.455, rx: 0.044, rz: 0.06, cz: 0.012 }], { seg: 16, color: mixc(col(0xc41f2a), [0, 0, 0], 0.55), capTop: false, capBottom: false }));
    }
  },
  starlight(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'metal', emblem(ctx, STAR, 0.37, 0.2, [0.95, 0.78, 0.3], 0.012));
    add('spine', 'metal', beltRing(ctx, 0.0, 0.04, [0.9, 0.72, 0.28], 0.008));
    add('spine', 'metal', xf(sphereG(0.014, 10, 8, [0.95, 0.8, 0.35]), { p: [0, 0.02, T(0.02).z + 0.012], s: [1, 1, 0.6] }));
    for (const sx of [-1, 1]) {
      add('spine', 'metal', xf(sphereG(1, 12, 8, [0.9, 0.72, 0.28]), { p: [sx * (prof(tk, 0.5).rx + 0.052), 0.575, 0], r: [0, 0, sx * -0.3], s: [0.06, 0.016, 0.052] }));
      // collar trim V
      add('spine', 'metal', tube([[sx * 0.05, 0.57, T(0.57).z * 0.7], [sx * 0.03, 0.52, T(0.52).z + 0.004], [0, 0.46, T(0.46).z + 0.006]], { radius: 0.0022, seg: 4, color: [0.9, 0.72, 0.28], steps: 8 }));
    }
    for (const S of ['L', 'R']) {
      add('kn' + S, 'metal', loft([{ y: -0.2, rx: 0.0485, rz: 0.053 }, { y: -0.17, rx: 0.049, rz: 0.0535 }], { seg: 18, color: [0.9, 0.72, 0.28], capTop: false, capBottom: false }));
    }
  },
  maeve(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const GB = [0.62, 0.5, 0.26];
    // sculpted chest plate + gorget
    add('spine', 'metal', loft([{ y: 0.18, rx: prof(tk, 0.18).rx + 0.008, rz: prof(tk, 0.18).rz + 0.01 }, { y: 0.32, rx: prof(tk, 0.32).rx + 0.012, rz: prof(tk, 0.32).rz + 0.016 }, { y: 0.46, rx: prof(tk, 0.46).rx + 0.01, rz: prof(tk, 0.46).rz + 0.012 }, { y: 0.54, rx: prof(tk, 0.54).rx + 0.006, rz: prof(tk, 0.54).rz + 0.01 }], { seg: 32, color: GB, capTop: false, capBottom: false, bump: (t, a) => (a > 0.2 && a < P - 0.2 ? 1 : 0.0) + (a > 0.2 && a < P - 0.2 ? 0 : 0.0) || 0.8 }));
    add('spine', 'metal', emblem(ctx, STAR, 0.36, 0.14, [0.9, 0.8, 0.45], 0.014));
    add('spine', 'metal', beltRing(ctx, -0.01, 0.05, [0.5, 0.4, 0.2], 0.009));
    add('spine', 'cloth', xf(boxG(0.05, 0.045, 0.03, [0.15, 0.13, 0.12]), { p: [0.12, 0.02, T(0.02).z * 0.7] })); add('spine', 'cloth', xf(boxG(0.05, 0.045, 0.03, [0.15, 0.13, 0.12]), { p: [-0.12, 0.02, T(0.02).z * 0.7] }));
    for (const sx of [-1, 1]) {
      add('spine', 'metal', xf(sphereG(1, 16, 10, GB), { p: [sx * (prof(tk, 0.5).rx + 0.052), 0.55, 0], r: [0, 0, sx * -0.35], s: [0.092, 0.05, 0.085] }));
      add('spine', 'metal', xf(sphereG(1, 12, 8, [0.8, 0.7, 0.4]), { p: [sx * (prof(tk, 0.5).rx + 0.06), 0.585, 0], r: [0, 0, sx * -0.35], s: [0.05, 0.016, 0.045] }));
    }
    for (const S of ['L', 'R']) {
      add('el' + S, 'metal', loft([{ y: -0.12, rx: 0.056, rz: 0.054 }, { y: -0.2, rx: 0.049, rz: 0.048 }, { y: -0.27, rx: 0.036, rz: 0.034 }], { seg: 18, color: GB, capTop: false, capBottom: false }));
      add('hp' + S, 'metal', loft([{ y: -0.12, rx: 0.088, rz: 0.088 }, { y: -0.3, rx: 0.07, rz: 0.07 }], { seg: 20, color: mixc(GB, [0, 0, 0], 0.2), capTop: false, capBottom: false, bump: (t, a) => (a > 0.4 && a < P - 0.4 ? 1.03 : 0.0) || 0.9 }));
      add('kn' + S, 'metal', xf(sphereG(0.052, 12, 8, GB), { p: [0, 0.005, 0.03], s: [1, 0.8, 0.7] }));
    }
  },
  atrain(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'metal', emblem(ctx, BOLT, 0.37, 0.24, [0.95, 0.95, 0.98], 0.012));
    add('spine', 'metal', beltRing(ctx, 0.0, 0.04, [0.9, 0.9, 0.95], 0.008));
    for (const sx of [-1, 1]) {
      // lightning stripe down the torso side/leg
      add('spine', 'metal', tube([[sx * (prof(tk, 0.45).rx * 0.96), 0.46, 0.0], [sx * (prof(tk, 0.3).rx * 0.99), 0.3, 0.012], [sx * (prof(tk, 0.15).rx), 0.15, 0.0], [sx * (prof(tk, 0.0).rx * 1.0), 0.0, 0.0]], { radius: 0.006, flat: 0.5, seg: 6, color: [0.95, 0.95, 0.98], steps: 12 }));
    }
    for (const S of ['L', 'R']) { const sx = S === 'L' ? 1 : -1;
      add('hp' + S, 'metal', tube([[sx * 0.092, 0.03, 0.0], [sx * 0.086, -0.15, 0.008], [sx * 0.07, -0.33, 0.004], [sx * 0.052, -0.44, 0.0]], { radius: 0.005, flat: 0.5, seg: 6, color: [0.95, 0.95, 0.98], steps: 12 }));
      add('kn' + S, 'cloth', loft([{ y: -0.40, rx: 0.036, rz: 0.04 }, { y: -0.455, rx: 0.044, rz: 0.06, cz: 0.012 }], { seg: 16, color: [0.92, 0.92, 0.95], capTop: false, capBottom: false }));
    }
  },
  deep(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const TEAL = [0.55, 0.88, 0.85];
    add('spine', 'metal', emblem(ctx, FIN, 0.375, 0.24, [0.7, 0.95, 0.92], 0.012));
    add('spine', 'metal', beltRing(ctx, -0.005, 0.045, [0.75, 0.92, 0.92], 0.008));
    for (const sx of [-1, 1]) {
      // gill slits on ribs
      for (let i = 0; i < 4; i++) add('spine', 'dark', xf(boxG(0.0035, 0.045, 0.004, [0.03, 0.18, 0.2]), { p: [sx * (prof(tk, 0.26 + i * 0.0).rx * 0.93 + 0.0 + i * 0.0), 0.2 + i * 0.045, T(0.2 + i * 0.045, sx > 0 ? 0.35 : P - 0.35).z * 0.4 + 0.02], r: [0, sx * -0.9, 0] }));
      // fin shoulders
      add('spine', 'metal', xf(sphereG(1, 12, 8, TEAL), { p: [sx * (prof(tk, 0.5).rx + 0.056), 0.585, -0.01], r: [0, sx * 0.3, sx * -0.9], s: [0.014, 0.075, 0.045] }));
      add('spine', 'metal', xf(sphereG(1, 12, 8, TEAL), { p: [sx * (prof(tk, 0.5).rx + 0.07), 0.55, 0.0], r: [0, 0, sx * -0.5], s: [0.06, 0.02, 0.055] }));
    }
    for (const S of ['L', 'R']) { const sx = S === 'L' ? 1 : -1; add('el' + S, 'metal', xf(sphereG(1, 10, 8, TEAL), { p: [sx * 0.044, -0.2, -0.01], r: [0, 0, 0], s: [0.006, 0.07, 0.03] })); }
  },
  noir(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const K = [0.05, 0.05, 0.06], KM = [0.16, 0.16, 0.18];
    add('spine', 'cloth', tube([[-0.16, 0.54, T(0.5).z * 0.5], [-0.07, 0.42, T(0.4).z + 0.01], [0.0, 0.28, T(0.28).z + 0.012], [0.09, 0.15, T(0.15).z + 0.012], [0.16, 0.02, T(0.02).z * 0.6]], { radius: 0.011, flat: 0.45, seg: 6, color: KM, steps: 16 }));
    add('spine', 'cloth', tube([[0.16, 0.54, T(0.5).z * 0.5], [0.07, 0.42, T(0.4).z + 0.01], [0.0, 0.28, T(0.28).z + 0.012], [-0.09, 0.15, T(0.15).z + 0.012], [-0.16, 0.02, T(0.02).z * 0.6]], { radius: 0.011, flat: 0.45, seg: 6, color: KM, steps: 16 }));
    add('spine', 'metal', xf(boxG(0.034, 0.034, 0.012, [0.3, 0.3, 0.32]), { p: [0, 0.28, T(0.28).z + 0.02] }));
    add('spine', 'metal', beltRing(ctx, -0.01, 0.055, KM, 0.009));
    for (let i = -1; i <= 1; i++) add('spine', 'cloth', xf(boxG(0.045, 0.06, 0.03, KM), { p: [i * 0.075, 0.02, T(0.02).z * 0.9 + 0.01] }));
    for (const sx of [-1, 1]) {
      add('spine', 'cloth', xf(sphereG(1, 12, 8, KM), { p: [sx * (prof(tk, 0.5).rx + 0.05), 0.56, 0], r: [0, 0, sx * -0.3], s: [0.082, 0.04, 0.075] }));
      add('spine', 'cloth', xf(boxG(0.1, 0.03, 0.045, KM), { p: [sx * 0.16, 0.5, 0.0], r: [0, 0, sx * 0.1] }));
    }
    for (const S of ['L', 'R']) {
      add('el' + S, 'cloth', loft([{ y: -0.1, rx: 0.056, rz: 0.054 }, { y: -0.25, rx: 0.042, rz: 0.04 }], { seg: 16, color: KM, capTop: false, capBottom: false }));
      add('kn' + S, 'cloth', xf(sphereG(0.056, 12, 8, KM), { p: [0, 0.0, 0.03], s: [1, 0.9, 0.7] }));
      add('hp' + S, 'cloth', xf(boxG(0.1, 0.1, 0.03, KM), { p: [(S === 'L' ? 1 : -1) * 0.005, -0.2, 0.1] }));
    }
  },
  soldierboy(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const LEA = [0.34, 0.22, 0.12];
    add('spine', 'metal', emblem(ctx, STAR, 0.38, 0.3, [0.96, 0.96, 0.98], 0.016));
    add('spine', 'cloth', beltRing(ctx, -0.01, 0.06, LEA, 0.009)); add('spine', 'metal', xf(boxG(0.06, 0.05, 0.016, [0.7, 0.55, 0.25]), { p: [0, 0.02, T(0.02).z + 0.013] }));
    for (const sx of [-1, 1]) {
      add('spine', 'cloth', tube([[sx * 0.17, 0.52, T(0.5).z * 0.4], [sx * 0.1, 0.36, T(0.36).z + 0.01], [sx * 0.02, 0.1, T(0.1).z + 0.01]], { radius: 0.0085, flat: 0.5, seg: 6, color: LEA, steps: 12 }));
      add('spine', 'cloth', xf(boxG(0.05, 0.065, 0.032, LEA), { p: [sx * 0.1, 0.12, T(0.12).z * 0.95 + 0.012] }));
      add('spine', 'cloth', xf(sphereG(1, 12, 8, [0.15, 0.25, 0.6]), { p: [sx * (prof(tk, 0.5).rx + 0.052), 0.565, 0], r: [0, 0, sx * -0.3], s: [0.07, 0.034, 0.066] }));
    }
    for (const S of ['L', 'R']) add('kn' + S, 'cloth', loft([{ y: -0.4, rx: 0.036, rz: 0.04 }, { y: -0.455, rx: 0.044, rz: 0.06, cz: 0.012 }], { seg: 16, color: [0.9, 0.9, 0.92], capTop: false, capBottom: false }));
  },
  butcher(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const COAT = [0.07, 0.07, 0.085];
    // long coat: shell over torso + skirts to knee, flared collar
    const rings = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const y = 0.56 - t * 1.08; const base = prof(tk, Math.max(-0.1, y)); const flare = y < 0 ? (-y) * 0.55 : 0; rings.push({ y, rx: base.rx + 0.012 + flare * 0.5, rz: base.rz + 0.014 + flare * 0.42, n: 2.4 }); }
    const coat = loft(rings, { seg: 32, color: COAT, capTop: false, capBottom: false, bump: (t, a) => (a > 0.05 && a < P - 0.05 && Math.abs(a - P / 2) < 0.13 && t > 0.15 ? 0.985 : 1) });
    add('spine', 'cloth', coat);
    add('spine', 'cloth', loft([{ y: 0.55, rx: 0.1, rz: 0.075, cz: -0.012 }, { y: 0.6, rx: 0.098, rz: 0.075, cz: -0.014 }, { y: 0.66, rx: 0.088, rz: 0.07, cz: -0.012 }], { seg: 22, color: COAT, capTop: false, capBottom: false }));
    for (const sx of [-1, 1]) add('spine', 'cloth', xf(boxG(0.05, 0.15, 0.015, [0.1, 0.1, 0.12]), { p: [sx * 0.07, 0.52, T(0.5).z + 0.02], r: [0.3, 0, sx * 0.4] }));
    add('spine', 'dark', xf(boxG(0.02, 0.5, 0.004, [0.02, 0.02, 0.02]), { p: [0, 0.28, T(0.28).z + 0.019] }));
    for (let i = 0; i < 4; i++) add('spine', 'metal', xf(sphereG(0.008, 6, 4, [0.35, 0.32, 0.28]), { p: [0.03, 0.08 + i * 0.1, T(0.1).z + 0.021] }));
  },
  hughie(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'cloth', loft([{ y: 0.55, rx: 0.098, rz: 0.075, cz: -0.012 }, { y: 0.6, rx: 0.092, rz: 0.07 }, { y: 0.64, rx: 0.07, rz: 0.062 }], { seg: 20, color: [0.2, 0.3, 0.4], capTop: false, capBottom: false }));
    add('spine', 'dark', xf(boxG(0.012, 0.52, 0.004, [0.7, 0.7, 0.72]), { p: [0, 0.27, T(0.27).z + 0.009] }));
    add('spine', 'cloth', beltRing(ctx, -0.03, 0.04, [0.18, 0.28, 0.38], 0.006));
  },
  mm(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const V = [0.1, 0.11, 0.1];
    const rings = []; for (let i = 0; i <= 6; i++) { const y = 0.08 + i * 0.075; const p = prof(tk, y); rings.push({ y, rx: p.rx + 0.016, rz: p.rz + 0.018, n: 2.4 }); }
    add('spine', 'cloth', loft(rings, { seg: 30, color: V, capTop: false, capBottom: false }));
    for (let i = -1; i <= 1; i++) { add('spine', 'cloth', xf(boxG(0.055, 0.075, 0.032, [0.16, 0.17, 0.15]), { p: [i * 0.065, 0.14, T(0.14).z + 0.03] })); }
    add('spine', 'cloth', xf(boxG(0.14, 0.14, 0.02, [0.07, 0.07, 0.07]), { p: [0, 0.38, T(0.38).z + 0.03] }));
    for (const sx of [-1, 1]) add('spine', 'cloth', xf(boxG(0.06, 0.02, 0.1, V), { p: [sx * 0.15, 0.545, 0], r: [0, 0, sx * 0.3] }));
  },
  frenchie(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'cloth', loft([{ y: 0.55, rx: 0.1, rz: 0.078 }, { y: 0.6, rx: 0.085, rz: 0.07 }, { y: 0.64, rx: 0.066, rz: 0.06 }], { seg: 20, color: [0.55, 0.12, 0.14], capTop: false, capBottom: false }));
    add('spine', 'cloth', tube([[-0.04, 0.6, T(0.55).z * 0.9], [-0.07, 0.5, T(0.5).z + 0.016], [-0.05, 0.38, T(0.38).z + 0.02]], { radius: 0.014, flat: 0.6, seg: 6, color: [0.55, 0.12, 0.14], steps: 10 }));
    add('spine', 'cloth', beltRing(ctx, -0.03, 0.05, [0.2, 0.14, 0.1], 0.007));
  },
  kimiko(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'cloth', loft([{ y: 0.55, rx: 0.09, rz: 0.072 }, { y: 0.61, rx: 0.074, rz: 0.066 }, { y: 0.645, rx: 0.056, rz: 0.058 }], { seg: 20, color: [0.07, 0.07, 0.09], capTop: false, capBottom: false }));
    add('spine', 'metal', xf(boxG(0.012, 0.5, 0.004, [0.5, 0.5, 0.52]), { p: [0, 0.27, T(0.27).z + 0.008] }));
    add('spine', 'cloth', beltRing(ctx, -0.04, 0.04, [0.12, 0.12, 0.14], 0.006));
  },
  edgar(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    const rings = []; for (let i = 0; i <= 8; i++) { const y = -0.15 + i * 0.09; const p = prof(tk, Math.max(-0.1, y)); rings.push({ y, rx: p.rx + 0.012, rz: p.rz + 0.014, n: 2.3 }); }
    add('spine', 'cloth', loft(rings, { seg: 30, color: [0.06, 0.06, 0.07], capTop: false, capBottom: false }));
    add('spine', 'cloth', xf(boxG(0.1, 0.5, 0.01, [0.9, 0.9, 0.92]), { p: [0, 0.3, T(0.3).z + 0.014] }));
    add('spine', 'cloth', xf(boxG(0.026, 0.4, 0.008, [0.1, 0.1, 0.16]), { p: [0, 0.32, T(0.32).z + 0.022], r: [0.02, 0, 0] }));
    for (const sx of [-1, 1]) add('spine', 'cloth', xf(boxG(0.055, 0.34, 0.01, [0.05, 0.05, 0.06]), { p: [sx * 0.07, 0.38, T(0.38).z + 0.02], r: [0, sx * -0.2, sx * -0.12] }));
    add('spine', 'cloth', loft([{ y: 0.56, rx: 0.075, rz: 0.062 }, { y: 0.61, rx: 0.062, rz: 0.058 }], { seg: 18, color: [0.92, 0.92, 0.94], capTop: false, capBottom: false }));
  },
  ashley(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp);
    add('spine', 'cloth', xf(boxG(0.075, 0.46, 0.01, [0.75, 0.7, 0.66]), { p: [0, 0.3, T(0.3).z + 0.013] }));
    for (const sx of [-1, 1]) add('spine', 'cloth', xf(boxG(0.05, 0.36, 0.01, [0.92, 0.92, 0.9]), { p: [sx * 0.06, 0.38, T(0.38).z + 0.02], r: [0, sx * -0.25, sx * -0.14] }));
    add('spine', 'cloth', beltRing(ctx, -0.04, 0.035, [0.8, 0.78, 0.74], 0.007));
    add('root', 'cloth', loft([{ y: -0.34, rx: 0.14, rz: 0.12 }, { y: -0.16, rx: 0.142, rz: 0.11 }, { y: 0.06, rx: 0.136, rz: 0.1 }], { seg: 28, color: [0.88, 0.87, 0.85], capTop: false, capBottom: false }));
  },
  neuman(ctx) {
    const { sp, add, T } = ctx;
    for (const sx of [-1, 1]) add('spine', 'cloth', xf(boxG(0.05, 0.36, 0.01, [0.55, 0.1, 0.18]), { p: [sx * 0.06, 0.38, T(0.38).z + 0.02], r: [0, sx * -0.25, sx * -0.14] }));
    add('spine', 'cloth', xf(boxG(0.07, 0.4, 0.008, [0.8, 0.8, 0.82]), { p: [0, 0.3, T(0.3).z + 0.013] }));
    add('spine', 'metal', xf(sphereG(0.012, 8, 6, [0.8, 0.7, 0.4]), { p: [0.1, 0.4, T(0.4).z + 0.03] }));
  },
  general(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const UN = [0.18, 0.26, 0.2];
    const rings = []; for (let i = 0; i <= 8; i++) { const y = -0.12 + i * 0.09; const p = prof(tk, Math.max(-0.1, y)); rings.push({ y, rx: p.rx + 0.012, rz: p.rz + 0.015, n: 2.3 }); }
    add('spine', 'cloth', loft(rings, { seg: 30, color: UN, capTop: false, capBottom: false }));
    const cols = [[0.8, 0.1, 0.1], [0.1, 0.2, 0.7], [0.9, 0.8, 0.2], [0.1, 0.5, 0.2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add('spine', 'cloth', xf(boxG(0.018, 0.008, 0.004, cols[(r + c) % 4]), { p: [0.04 + c * 0.02, 0.42 - r * 0.012, T(0.42).z + 0.02] }));
    for (const sx of [-1, 1]) { add('spine', 'metal', xf(sphereG(1, 10, 8, GOLD), { p: [sx * (prof(tk, 0.5).rx + 0.05), 0.565, 0], s: [0.06, 0.012, 0.045] })); add('spine', 'metal', xf(boxG(0.04, 0.12, 0.008, [0.8, 0.8, 0.8]), { p: [sx * 0.04, 0.4, T(0.4).z + 0.018], r: [0, 0, 0] })); }
    add('spine', 'cloth', xf(boxG(0.06, 0.12, 0.01, [0.9, 0.9, 0.92]), { p: [0, 0.48, T(0.48).z + 0.017] }));
  },
  soldier(ctx) {
    const { sp, add, T } = ctx; const tk = torsoKeys(sp); const V = [0.18, 0.2, 0.16];
    const rings = []; for (let i = 0; i <= 6; i++) { const y = 0.02 + i * 0.09; const p = prof(tk, y); rings.push({ y, rx: p.rx + 0.014, rz: p.rz + 0.016, n: 2.4 }); }
    add('spine', 'cloth', loft(rings, { seg: 26, color: V, capTop: false, capBottom: false }));
    for (let i = -1; i <= 1; i++) add('spine', 'cloth', xf(boxG(0.05, 0.07, 0.03, [0.13, 0.15, 0.12]), { p: [i * 0.06, 0.1, T(0.1).z + 0.03] }));
    add('spine', 'cloth', xf(boxG(0.16, 0.16, 0.02, [0.08, 0.09, 0.08]), { p: [0, 0.38, T(0.38).z + 0.03] }));
    add('spine', 'cloth', beltRing(ctx, -0.03, 0.05, [0.16, 0.14, 0.1], 0.008));
  },
  civilian() {},
};
