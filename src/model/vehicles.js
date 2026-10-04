import * as THREE from 'three';
import { loft, tube, merge, paint, xf, sphereG, boxG, cylG, hexRGB } from './geo.js';
import { glowSprite } from '../fx.js';

const vm = (p = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35, ...p });
const mesh = (g, m) => new THREE.Mesh(g, m);
const jit = (c, a) => [Math.max(0, Math.min(1, c[0] + a)), Math.max(0, Math.min(1, c[1] + a)), Math.max(0, Math.min(1, c[2] + a))];
const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };
const wing = (span, root, tip, sweep, th, color) => {
  const sh = new THREE.Shape(); sh.moveTo(0, root / 2); sh.lineTo(span, tip / 2 - sweep); sh.lineTo(span, -tip / 2 - sweep); sh.lineTo(0, -root / 2); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: th * 0.3, bevelSize: th * 0.3, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, th / 2, 0); paint(g, color); return g;
};

/* ============================ FIGHTER JET ============================ */
export function makeJet(c = 0x6b747b) {
  const g = new THREE.Group(); const base = hexRGB(c); const dk = jit(base, -0.22), lt = jit(base, 0.08);
  const m = vm({ roughness: 0.42, metalness: 0.5 });
  // fuselage along z
  const rings = []; const N = 24; for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -5.8 + t * 13.4; let rx, rz; if (t < 0.28) { const u = t / 0.28; rx = 0.55 + 0.35 * u; rz = 0.45 + 0.3 * u; } else if (t < 0.78) { const u = (t - 0.28) / 0.5; rx = 0.9 + 0.55 * Math.sin(u * Math.PI * 0.5); rz = 0.75 + 0.1 * u; } else { const u = (t - 0.78) / 0.22; rx = 1.45 * Math.cos(u * Math.PI * 0.46) + 0.03; rz = 0.85 * Math.cos(u * Math.PI * 0.46) + 0.03; } rings.push({ y: z, rx, rz, n: 2.5 }); }
  const fus = alongZ(loft(rings, { seg: 22, colorFn: (t, a, i, p) => (Math.sin(a) > 0.55 ? jit(lt, 0) : jit(base, 0.02 * Math.sin(p[1] * 3))) }));
  const parts = [fus];
  // engine nacelles + nozzles
  for (const sx of [-1, 1]) {
    parts.push(alongZ(loft([{ y: -5.6, rx: 0.62, rz: 0.62 }, { y: -2, rx: 0.7, rz: 0.7 }, { y: 0.5, rx: 0.64, rz: 0.64 }], { seg: 14, color: dk })).translate(sx * 0.95, -0.1, 0));
    parts.push(alongZ(loft([{ y: -6.2, rx: 0.5, rz: 0.5 }, { y: -5.5, rx: 0.64, rz: 0.64 }], { seg: 14, color: [0.1, 0.1, 0.12] })).translate(sx * 0.95, -0.1, 0));
    parts.push(xf(boxG(0.1, 2.3, 1.7, dk), { p: [sx * 1.6, 1.3, -4.4], r: [0, 0, sx * 0.22] }));   // twin tails
    parts.push(xf(boxG(2.4, 0.12, 1.6, dk), { p: [sx * 2.3, 0.0, -5.3] }));                          // stabilisers
    parts.push(xf(boxG(0.1, 0.7, 1.2, dk), { p: [sx * 1.3, -0.8, -3.8], r: [0, 0, sx * -0.4] }));    // ventral fins
    parts.push(xf(boxG(1.1, 0.5, 2.3, jit(base, -0.1)), { p: [sx * 0.95, -0.2, 3.2] }));              // intake ramps
    parts.push(xf(sphereG(0.5, 10, 8, [0.06, 0.06, 0.07]), { p: [sx * 0.95, -0.2, 4.4], s: [1.1, 0.8, 0.6] }));
    // underwing missiles
    for (const k of [0, 1]) { parts.push(alongZ(loft([{ y: -1.2, rx: 0.1, rz: 0.1 }, { y: 1.2, rx: 0.13, rz: 0.13 }, { y: 1.7, rx: 0.02, rz: 0.02 }], { seg: 8, color: [0.85, 0.85, 0.88] })).translate(sx * (2.2 + k * 0.9), -0.45, 0.6)); parts.push(xf(boxG(0.4, 0.04, 0.5, dk), { p: [sx * (2.2 + k * 0.9), -0.3, -0.4] })); }
  }
  // spine & canopy frame
  parts.push(xf(sphereG(1, 12, 8, lt), { p: [0, 0.9, -1.4], s: [0.6, 0.28, 3.4] }));
  parts.push(xf(sphereG(1, 10, 8, [0.95, 0.65, 0.25]), { p: [0, 0.7, 3.1], s: [0.52, 0.42, 1.45] }));
  parts.push(xf(boxG(0.7, 0.05, 0.08, dk), { p: [0, 1.07, 3.1] }));
  parts.push(xf(new THREE.ConeGeometry(0.1, 1.2, 8), { p: [0, 0.05, 8.2], r: [Math.PI / 2, 0, 0] })); paint(parts[parts.length - 1], dk);
  g.add(mesh(merge(parts), m));
  // glass
  const glass = mesh(xf(sphereG(1, 12, 8, [1, 0.7, 0.3]), { p: [0, 0.75, 3.1], s: [0.5, 0.4, 1.4] }), new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffc080, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.7 })); g.add(glass);
  // swing wings
  g.wings = [];
  for (const sx of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(sx * 1.2, -0.1, 0.8); g.add(piv);
    const w = wing(5.2, 3.6, 1.2, 1.5, 0.14, lt); if (sx < 0) w.scale(-1, 1, 1);
    const wm = mesh(w, m); if (sx < 0) { wm.scale.x = 1; wm.material = m.clone(); wm.material.side = THREE.DoubleSide; }
    piv.add(wm); g.wings.push(piv);
  }
  g.abL = glowSprite(0xffa04a, 3.6, 0); g.abL.position.set(-0.95, -0.1, -6.4); g.abR = glowSprite(0xffa04a, 3.6, 0); g.abR.position.set(0.95, -0.1, -6.4); g.add(g.abL, g.abR);
  g.afterburn = (v) => { g.abL.material.opacity = v; g.abR.material.opacity = v; };
  g.scale.setScalar(0.9);
  return g;
}

/* ============================ CHINOOK ============================ */
export function makeChinook(cargo = true) {
  const g = new THREE.Group(); const O = [0.3, 0.34, 0.25], O2 = [0.24, 0.27, 0.2], D = [0.09, 0.1, 0.08];
  const m = vm({ roughness: 0.65, metalness: 0.15 });
  const rings = []; const N = 20; for (let i = 0; i < N; i++) { const t = i / (N - 1); const z = -5.2 + t * 10.6; let rx = 1.2, rz = 1.2; if (t > 0.86) { const u = (t - 0.86) / 0.14; rx = 1.2 * Math.cos(u * Math.PI * 0.4) + 0.2; rz = 1.2 * Math.cos(u * Math.PI * 0.42) + 0.2; } if (t < 0.12) { const u = t / 0.12; rz = 0.7 + 0.5 * u; rx = 0.9 + 0.3 * u; } rings.push({ y: z, rx, rz, n: 3.0 }); }
  const parts = [alongZ(loft(rings, { seg: 20, colorFn: (t, a, i, p) => (Math.sin(a) < -0.4 ? jit(O2, 0) : jit(O, 0.02 * Math.sin(p[1] * 4))) }))];
  parts.push(xf(boxG(1.4, 1.9, 1.9, O2), { p: [0, 1.7, -4.3] }));       // aft pylon
  parts.push(xf(boxG(0.9, 1.0, 1.5, O2), { p: [0, 1.6, 2.6] }));        // fwd pylon
  for (const sx of [-1, 1]) {
    parts.push(alongZ(loft([{ y: -2.4, rx: 0.3, rz: 0.5 }, { y: 0.0, rx: 0.5, rz: 0.7 }, { y: 2.6, rx: 0.3, rz: 0.5 }], { seg: 12, color: O2 })).translate(sx * 1.35, -0.75, 0.3));  // sponsons
    for (let i = 0; i < 6; i++) parts.push(xf(boxG(0.05, 0.38, 0.5, [0.05, 0.08, 0.1]), { p: [sx * 1.21, 0.25, -1.8 + i * 0.85] }));
    parts.push(xf(cylG(0.06, 0.06, 1.4, 6, D), { p: [sx * 1.35, -1.5, 2.4], r: [0, 0, 0] })); parts.push(xf(cylG(0.2, 0.2, 0.2, 10, D), { p: [sx * 1.35, -2.15, 2.4], r: [0, 0, Math.PI / 2] }));
    parts.push(xf(cylG(0.06, 0.06, 1.4, 6, D), { p: [sx * 1.35, -1.5, -3.2] })); parts.push(xf(cylG(0.2, 0.2, 0.2, 10, D), { p: [sx * 1.35, -2.15, -3.2], r: [0, 0, Math.PI / 2] }));
  }
  parts.push(xf(boxG(1.9, 0.25, 1.6, D), { p: [0, -0.9, -5.6], r: [0.25, 0, 0] }));        // ramp
  parts.push(xf(boxG(1.6, 0.45, 0.8, [0.12, 0.2, 0.25]), { p: [0, 0.35, 5.0], r: [-0.15, 0, 0] })); // windscreen
  g.add(mesh(merge(parts), m));
  g.rotors = [];
  for (const [z, y] of [[2.6, 2.25], [-4.3, 3.7]]) { const r = new THREE.Group(); r.position.set(0, y, z); g.add(r); const bl = [cylG(0.25, 0.3, 0.3, 10, D)]; for (let i = 0; i < 3; i++) bl.push(xf(boxG(11, 0.07, 0.5, [0.06, 0.06, 0.06]), { r: [0, (i * Math.PI) / 3, 0] })); r.add(mesh(merge(bl), vm())); g.rotors.push(r); }
  if (cargo) { const c = new THREE.Group(); c.position.set(0, -4.4, 0.5); g.add(c); const cr = [xf(boxG(2.5, 2.1, 2.5, [0.46, 0.38, 0.24]), {})]; for (let i = -1; i <= 1; i++) { cr.push(xf(boxG(2.52, 0.08, 0.1, [0.2, 0.17, 0.1]), { p: [0, i * 0.7, 1.27] })); cr.push(xf(boxG(0.1, 2.1, 0.1, [0.2, 0.17, 0.1]), { p: [i * 0.9, 0, 1.27] })); } cr.push(xf(boxG(1.2, 0.5, 0.05, [0.7, 0.7, 0.2]), { p: [0, 0.2, 1.27] })); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cr.push(tube([[x * 0.5, 2.0, z * 0.5], [x * 0.2, 3.0, z * 0.2], [0, 4.2, 0]], { radius: 0.02, seg: 4, color: D, steps: 4 })); c.add(mesh(merge(cr), m)); g.cargo = c; }
  g.spin = (T) => g.rotors.forEach((r, i) => (r.rotation.y = T * 30 * (i ? -1 : 1)));
  return g;
}

/* ============================ MAIN BATTLE TANK ============================ */
export function makeTank(c = 0x55603f) {
  const g = new THREE.Group(); const base = hexRGB(c); const dk = jit(base, -0.18), lt = jit(base, 0.05); const BL = [0.06, 0.06, 0.06];
  const m = vm({ roughness: 0.7, metalness: 0.2 });
  const hull = [];
  const hr = [{ y: 0.55, rx: 1.65, rz: 3.7, n: 4 }, { y: 1.05, rx: 1.62, rz: 3.6, n: 4 }, { y: 1.45, rx: 1.45, rz: 3.2, n: 4 }]; hull.push(loft(hr, { seg: 28, color: base }));
  hull.push(xf(boxG(3.3, 0.5, 1.7, lt), { p: [0, 1.0, 3.3], r: [-0.45, 0, 0] }));                      // glacis
  hull.push(xf(boxG(3.1, 0.45, 1.2, dk), { p: [0, 1.0, -3.7], r: [0.3, 0, 0] }));                      // rear plate
  for (const sx of [-1, 1]) {
    hull.push(xf(boxG(1.0, 1.05, 8.4, BL), { p: [sx * 1.95, 0.55, 0] }));                                // track block
    hull.push(xf(boxG(1.1, 0.12, 8.6, dk), { p: [sx * 1.95, 1.12, 0] }));                                 // fender
    for (let i = 0; i < 7; i++) hull.push(xf(cylG(0.46, 0.46, 0.2, 14, [0.16, 0.16, 0.16]), { p: [sx * 2.5, 0.5, -3.3 + i * 1.1], r: [0, 0, Math.PI / 2] }));
    hull.push(xf(cylG(0.52, 0.52, 0.22, 14, dk), { p: [sx * 2.5, 0.8, 3.9], r: [0, 0, Math.PI / 2] })); hull.push(xf(cylG(0.5, 0.5, 0.22, 14, dk), { p: [sx * 2.5, 0.75, -4.0], r: [0, 0, Math.PI / 2] }));
    hull.push(xf(boxG(0.1, 0.34, 2.3, lt), { p: [sx * 2.5, 1.12, 2.4] }));                               // skirt
    hull.push(xf(boxG(0.5, 0.4, 0.6, dk), { p: [sx * 1.2, 1.6, -3.0] }));                                 // engine vents
  }
  g.add(mesh(merge(hull), m));
  g.turret = new THREE.Group(); g.turret.position.set(0, 1.8, -0.3); g.add(g.turret);
  const tr = [{ y: -0.05, rx: 1.55, rz: 2.0, n: 3.0 }, { y: 0.35, rx: 1.4, rz: 1.9, n: 3.0 }, { y: 0.75, rx: 1.0, rz: 1.5, n: 3.0 }, { y: 0.86, rx: 0.8, rz: 1.2, n: 3.0 }];
  const tp = [loft(tr, { seg: 24, color: base, colorFn: (t, a, i, p) => jit(t < 0.5 ? base : lt, 0.02 * Math.sin(p[0] * 9)) })];
  tp.push(xf(boxG(1.7, 1.0, 0.8, dk), { p: [0, 0.3, 2.0] }));                                            // mantlet
  tp.push(xf(boxG(1.2, 0.5, 1.3, dk), { p: [0, 0.45, -2.1] }));                                          // bustle
  tp.push(xf(cylG(0.4, 0.4, 0.18, 12, dk), { p: [0.6, 0.95, -0.3] })); tp.push(xf(cylG(0.28, 0.28, 0.12, 12, lt), { p: [-0.55, 0.92, 0.5] }));
  tp.push(xf(cylG(0.05, 0.05, 0.8, 5, BL), { p: [0.6, 1.6, -1.8], r: [0.1, 0, 0.0] }));
  tp.push(xf(cylG(0.06, 0.06, 1.2, 6, BL), { p: [0.6, 1.25, 0.5], r: [Math.PI / 2, 0, 0] }));            // MG
  g.turret.add(mesh(merge(tp), m));
  const barrel = [alongZ(loft([{ y: 2.2, rx: 0.2, rz: 0.2 }, { y: 4.0, rx: 0.17, rz: 0.17 }, { y: 6.0, rx: 0.15, rz: 0.15 }, { y: 6.5, rx: 0.2, rz: 0.2 }, { y: 6.9, rx: 0.2, rz: 0.2 }], { seg: 12, color: BL })), xf(cylG(0.24, 0.24, 0.5, 10, dk), { p: [0, 0, 4.5], r: [Math.PI / 2, 0, 0] })];
  g.gun = mesh(merge(barrel), m); g.gun.position.set(0, 0.3, 0); g.turret.add(g.gun);
  g.flash = glowSprite(0xffcc88, 4.5, 0); g.flash.position.set(0, 0.3, 7.1); g.turret.add(g.flash);
  return g;
}
