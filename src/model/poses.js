const sin = Math.sin, cos = Math.cos;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
/* ---- Pose library ---- */
export const P = {
  idle: (t, a = 1) => ({ ry: sin(t * 1.6) * 0.004 * a, sx: sin(t * 1.6) * 0.012 * a, lax: 0.04, rax: 0.04, laz: 0.1, raz: 0.1, le: 0.1, re: 0.1, hx: sin(t * 0.7) * 0.02 }),
  stand: (t = 0) => ({ ry: sin(t * 1.6) * 0.004, lax: 0.0, rax: 0.0, laz: 0.07, raz: 0.07, le: 0.08, re: 0.08 }),
  hero: (t = 0) => ({ ry: sin(t * 1.4) * 0.005, sx: -0.04, hx: -0.04, lax: -0.05, rax: -0.05, laz: 0.32, raz: 0.32, le: 0.5, re: 0.5, llz: 0.06, rlz: 0.06 }),
  arms_crossed: (t = 0) => ({ ry: sin(t * 1.4) * 0.004, lax: 0.6, rax: 0.7, laz: -0.5, raz: -0.45, le: 2.1, re: 2.0, lay: 0.2 }),
  walk: (ph, spd = 1) => {
    const a = sin(ph) * 0.65 * spd, b = -a, k1 = Math.max(0, -sin(ph + 0.9)) * 0.9 * spd, k2 = Math.max(0, sin(ph + 0.9)) * 0.9 * spd;
    return { ry: Math.abs(cos(ph)) * 0.035 * spd - 0.02, sy: sin(ph) * 0.12 * spd, sx: 0.05 * spd, llh: a, rlh: b, lk: k1, rk: k2, lax: b * 0.7, rax: a * 0.7, laz: 0.08, raz: 0.08, le: 0.3 + Math.max(0, b) * 0.4, re: 0.3 + Math.max(0, a) * 0.4 };
  },
  run: (ph, spd = 1) => {
    const a = sin(ph) * 1.1, b = -a, k1 = (0.3 + Math.max(0, -sin(ph + 1.1)) * 1.6), k2 = (0.3 + Math.max(0, sin(ph + 1.1)) * 1.6);
    return { ry: -0.05 + Math.abs(cos(ph)) * 0.08, rx: 0.28, sx: 0.12, sy: sin(ph) * 0.2, hx: -0.2, llh: a, rlh: b, lk: k1, rk: k2, lax: b * 0.95, rax: a * 0.95, laz: 0.12, raz: 0.12, le: 1.4, re: 1.4 };
  },
  sprint: (ph) => {
    const a = sin(ph) * 1.4, b = -a;
    return { ry: -0.12, rx: 0.5, sx: 0.12, hx: -0.4, llh: a, rlh: b, lk: 0.4 + Math.max(0, -sin(ph + 1.1)) * 1.9, rk: 0.4 + Math.max(0, sin(ph + 1.1)) * 1.9, lax: b * 1.1, rax: a * 1.1, le: 1.5, re: 1.5, laz: 0.1, raz: 0.1 };
  },
  // Superman-style flying (body horizontal). pitch: 0 = horizontal, 1 = vertical up
  fly: (t, up = 0) => ({ rx: lerp(1.45, 0.05, up), ry: 0, hx: lerp(-0.6, 0, up) * 0.6, lax: lerp(2.9, 0.1, up), rax: lerp(2.9, 0.1, up), laz: 0.08, raz: 0.08, le: 0.05, re: 0.05, llh: -0.05 + sin(t * 3) * 0.05, rlh: -0.05 - sin(t * 3) * 0.05, lk: 0.1, rk: 0.1 }),
  hover: (t) => ({ ry: sin(t * 1.5) * 0.05, rx: 0.05, lax: 0.05, rax: 0.05, laz: 0.35, raz: 0.35, le: 0.45, re: 0.45, llh: 0.1, rlh: -0.05, lk: 0.2, rk: 0.35, hx: -0.05 }),
  aim: (t = 0) => ({ ry: -0.1, sx: 0.05, sy: -0.35, lax: 1.35, rax: 1.45, laz: -0.05, raz: -0.12, le: 0.55, re: 0.6, lay: -0.5, ray: -0.2, llh: 0.15, rlh: -0.25, lk: 0.25, rk: 0.3, hx: 0.0, hy: 0.35 }),
  crouchAim: (t = 0) => ({ ry: -0.4, sx: 0.15, sy: -0.35, lax: 1.3, rax: 1.4, laz: -0.05, raz: -0.12, le: 0.6, re: 0.6, lay: -0.5, ray: -0.2, llh: 1.0, rlh: 0.5, lk: 1.6, rk: 1.5, hy: 0.35 }),
  punch: (u) => { const w = smooth(u < 0.5 ? u / 0.5 : 1 - (u - 0.5) / 0.5); return { rx: 0.1 * w, sy: -0.7 * w + 0.35 * (1 - w), ryaw: -0.2 * w, lax: 0.4, rax: 1.55 * w, raz: 0.2, le: 0.2 + (1 - w) * 0.9, re: 0.15 + (1 - w) * 2.2, llh: 0.35, rlh: -0.45, lk: 0.2, rk: 0.4, hx: -0.05 }; },
  slam: (u) => { const w = smooth(u); return { rx: 0.6 * w, ry: -0.2 * w, lax: 0.4 + 1.8 * (1 - w), rax: 0.4 + 1.8 * (1 - w), le: 0.5, re: 0.5, llh: 0.4 * w, rlh: -0.3 * w, lk: 0.6 * w, rk: 0.2 * w, hx: -0.2 }; },
  raise: (u) => { const w = smooth(u); return { rx: -0.05, lax: 3.0 * w, rax: 3.0 * w, laz: 0.15, raz: 0.15, le: 0.1, re: 0.1, hx: -0.5 * w }; },
  point: (t = 0) => ({ rax: 1.5, raz: 0.05, re: 0.1, lax: 0.1, laz: 0.1, le: 0.3, sy: -0.2, hy: 0.2 }),
  gesture: (t, a = 1) => ({ ry: sin(t * 1.6) * 0.004, hx: sin(t * 2.1) * 0.04, hy: sin(t * 1.3) * 0.08, lax: 0.45 + sin(t * 3.1) * 0.35 * a, rax: 0.35 + sin(t * 2.3 + 1) * 0.3 * a, laz: 0.2, raz: 0.2, le: 1.0 + sin(t * 3.1) * 0.3 * a, re: 0.9 + sin(t * 2.3 + 1) * 0.3 * a }),
  sit: (t = 0, a = 0.5) => ({ ry: -0.45, llh: 1.5, rlh: 1.5, lk: 1.55, rk: 1.55, lax: 0.55 + sin(t * 2.6) * 0.1 * a, rax: 0.55, le: 1.0, re: 1.0, laz: 0.15, raz: 0.15, sx: 0.04, hx: sin(t * 1.9) * 0.03, hy: sin(t * 0.9) * 0.1 }),
  hurt: (u) => { const w = smooth(u); return { rx: -0.35 * w, sx: -0.3 * w, hx: -0.4 * w, lax: -0.7 * w, rax: -0.5 * w, laz: 0.6 * w, raz: 0.5 * w, le: 0.4, re: 0.4, llh: 0.3 * w, rlh: -0.2 * w, lk: 0.3, rk: 0.5 }; },
  die: (u) => { // forward collapse onto knees then flat on back
    const w = smooth(u);
    const down = smooth(clamp((u - 0.3) / 0.7));
    return { ry: -0.97 * 0.9 * down + 0.0, rx: -1.57 * down, sx: -0.1 * w, hx: -0.3 * w, lax: -0.4 * w, rax: -0.2 * w, laz: 0.9 * w, raz: 0.9 * w, le: 0.3 + 0.4 * w, re: 0.3 + 0.4 * w, llh: 0.6 * (1 - down), rlh: -0.1 * (1 - down), lk: 0.9 * (1 - down), rk: 1.4 * (1 - down) };
  },
  dead: () => ({ ry: -0.88, rx: -1.57, hx: -0.1, lax: -0.1, rax: 0.0, laz: 0.4, raz: 0.5, le: 0.2, re: 0.3, llz: 0.15, rlz: 0.1, lk: 0.1, rk: 0.2 }),
  cower: (t) => ({ ry: -0.45, rx: 0.5, sx: 0.5, hx: 0.3, lax: 1.0, rax: 1.0, laz: -0.2, raz: -0.2, le: 2.2, re: 2.2, llh: 1.2, rlh: 1.1, lk: 1.9, rk: 1.8 }),
  zombie: (ph) => ({ ry: -0.03, rx: 0.2, sx: 0.28, hx: 0.3 + sin(ph * 0.5) * 0.08, hz: sin(ph * 0.5) * 0.15, lax: 1.4 + sin(ph) * 0.12, rax: 1.3 - sin(ph) * 0.12, laz: 0.1, raz: 0.15, le: 0.25, re: 0.3, llh: sin(ph) * 0.45, rlh: -sin(ph) * 0.45, lk: Math.max(0, -sin(ph + 1)) * 0.5, rk: Math.max(0, sin(ph + 1)) * 0.5, sy: sin(ph) * 0.12 }),
  kneel: (t = 0) => ({ ry: -0.5, sx: 0.1, hx: 0.2, lax: 0.2, rax: 0.2, laz: 0.2, raz: 0.2, le: 0.6, re: 0.6, llh: 1.5, rlh: 0.1, lk: 1.7, rk: 1.9 }),
  carry: (t = 0) => ({ lax: 1.0, rax: 1.0, laz: -0.2, raz: -0.2, le: 1.1, re: 1.1 }),
  salute: (t = 0) => ({ rax: 1.8, raz: -0.2, re: 2.4, lax: 0.05, laz: 0.08, le: 0.1 }),
  lookup: (t = 0) => ({ hx: -0.55, sx: -0.06, lax: 0.04, rax: 0.04, laz: 0.1, raz: 0.1, le: 0.1, re: 0.1 }),
  blend(a, b, w) { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] || 0, b[k] || 0, w); return o; },
};

