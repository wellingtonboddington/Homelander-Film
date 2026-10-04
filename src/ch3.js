import { C } from './cam.js';
import { P } from './models.js';
import { sampleTrack } from './common.js';
import { lerp, smooth, clamp, hash } from './util.js';

export function ch3(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, flash, pb } = x;
  const NY = W.ny, AIR = W.air;
  const at = (keys, t) => { const s = sampleTrack(keys, t, {}); return [s.x, s.y, s.z]; };

  chapter(232, 236.4, 'HOUR 03', 'The Armed Forces · 21:05 EST');
  cue(232, 'tick');
  loc(237, 242, 'Air Force Base — Northeast Command');

  /* ---- the base ---- */
  AIR.chinTrack[0].push([[230, -170, 62, -52], [262, 260, 68, -48]]);
  AIR.chinTrack[1].push([[230, -230, 78, -40], [262, 200, 72, -36]]);
  AIR.chinTrack[2].push([[230, -300, 70, -60], [262, 140, 76, -58]]);
  shot(232, 241, 'air', C({ p: [[-16, 1.9, 36], [-8, 2.0, 28]], l: [[6, 3.5, 12], [12, 4.5, 8]], fov: [42, 38], hand: 0.3 }), {
    holdBlack: 3.8, fadeIn: 1.6,
    act: (k) => { const T = k.T; AIR.put(0, 14, 24, 2.4, P.idle(T)); AIR.put(1, 17, 26, 0.6, P.idle(T)); AIR.put(2, -1, 30, 1.2, P.walk(T * 5, 0.6)); AIR.put(3, 4, -2, -1.6, P.idle(T)); } });
  cue(232, 'rotor', { dur: 20, g: 0.25 }, 'air'); cue(234, 'siren', { dur: 12, g: 0.07 }, 'air');
  cue(237.5, 'radio', {}, 'air'); say('RAD', 237.8, 3.4, 'All wings, Command. Scramble, scramble. Weapons free on all unidentified contacts.', { radio: true });

  /* ---- scramble ---- */
  AIR.jetTrack[0].push([[241, -190, 1.5, 38], [245, -40, 1.5, 38], [247, 70, 9, 36], [250, 260, 90, 24], [254, 560, 260, 0]]);
  AIR.jetTrack[1].push([[241.8, -220, 1.5, 44], [245.8, -70, 1.5, 44], [247.8, 40, 8, 42], [250.6, 240, 88, 30], [254, 540, 250, 10]]);
  AIR.jetTrack[2].push([[242.6, -250, 1.5, 32], [246.6, -100, 1.5, 32], [248.6, 10, 7, 30], [251.2, 220, 86, 18], [254, 500, 240, 20]]);
  shot(241, 249, 'air', C({ p: [[-6, 1.5, 58], [-4, 1.7, 58]], l: [[-70, 3, 38], [60, 8, 38]], fov: [44, 40], hand: 0.4, shake: 0.03 }));
  cue(241, 'jet', { dur: 3.0, pan0: -1, pan1: 1, g: 0.5 }, 'air'); cue(241.8, 'jet', { dur: 3.0, pan0: -1, pan1: 1, g: 0.45 }, 'air'); cue(242.6, 'jet', { dur: 3.0, pan0: -1, pan1: 1, g: 0.4 }, 'air');
  cue(241, 'burner', { dur: 7, g: 0.35 }, 'air'); say('PIL', 243.6, 2.4, 'Viper One, rolling.', { radio: true });
  cue(246.5, 'whoosh', { dur: 2, g: 0.4 }, 'air');

  shot(249, 254, 'air', C({ p: (u, k) => { const s = sampleTrack(AIR.jetTrack[0][0], k.T, {}); return [s.x - 30, s.y + 5, 66]; }, l: (u, k) => { const s = sampleTrack(AIR.jetTrack[0][0], k.T, {}); return [s.x + 6, s.y, s.z]; }, fov: [44, 36], hand: 0.5 }), {
    act: (k) => { AIR.put(0, -8, 52, 2.8, P.salute(k.T)); AIR.put(1, 6, 50, 2.4, P.idle(k.T)); } });
  say('RAD', 249.4, 3.6, 'Viper flight, vector zero-one-zero. Contacts at three hundred feet. They’re… big.', { radio: true });

  /* ---- the dogfight ---- */
  const J = [
    [[254, -220, 430, 560], [258, -130, 420, 150], [261, -70, 422, -90], [265, 30, 400, -300]],
    [[254, -170, 460, 580], [258, -80, 436, 190], [261, 10, 428, -70], [265, 120, 404, -270]],
    [[254, -270, 404, 540], [258, -170, 410, 150], [260.6, -100, 402, -80]],
  ];
  const G = [
    [[254, 60, 426, -760], [258, -10, 420, -340], [258.6, -40, 418, -230]],
    [[254, 120, 452, -780], [258, 20, 436, -390], [258.9, -10, 432, -250]],
    [[254, -90, 395, -750], [258, -120, 407, -330], [261, -120, 408, -120], [264, -60, 380, 200]],
    [[254, 20, 380, -800], [259, 40, 415, -300], [262, 60, 390, -50], [266, 60, 340, 200]],
  ];
  J.forEach((k, i) => NY.jetTrack[i].push(k));
  G.forEach((k, i) => NY.gunTrack[2 + i].push(k));
  const miss = (from, to, t0, dur, hitBoom) => {
    NY.beams.add({ a: from, b: to, t0, dur, travel: 0.3, w: 0.3, color: 0xfff0d0 });
    NY.fx.trail((u) => [lerp(from[0], to[0], u), lerp(from[1], to[1], u), lerp(from[2], to[2], u)], t0, t0 + dur * 0.85, 22, 2.2, [1, 0.95, 0.85, 0.7], [0.7, 0.7, 0.7, 0], 1.6);
    cue(t0, 'whoosh', { dur: dur, g: 0.25 }, 'ny');
    if (hitBoom) { NY.boom(t0 + dur * 0.87, to[0], to[1], to[2], 2.4); NY.boom(t0 + dur * 0.87 + 0.45, to[0] + 6, to[1] - 24, to[2] + 8, 1.5); }
  };
  { const tg = at(G[0], 258.5), tg2 = at(G[1], 258.8);
    miss(at(J[0], 257.4), tg, 257.6, 0.9, true); miss(at(J[1], 257.6), tg2, 257.8, 1.0, true); }
  NY.gunFire(2, 258.2, 258.5, at(J[1], 258.4), 20); NY.gunFire(4, 258.4, 261, at(J[2], 259.4), 28); NY.gunFire(5, 259.6, 262.6, at(J[0], 260.5), 26);
  NY.tracers.burst(at(G[2], 259.0), at(J[2], 260.0), 259.2, 260.5, 30, 3, 220);
  NY.boom(260.6, ...at(J[2], 260.55), 2.0); NY.boom(261.1, ...at(J[2], 260.55).map((v, i) => v + [10, -35, -12][i]), 1.2);
  NY.fx.burn(...at(J[2], 260.55), 260.6, 263, 2.4);
  cue(255, 'jet', { dur: 4, pan0: -0.5, pan1: 0.5, g: 0.5 }, 'ny'); cue(256, 'jet', { dur: 4, pan0: 0.6, pan1: -0.6, g: 0.4 }, 'ny');
  shot(254, 257.6, 'ny', C({ p: (u, k) => { const s = sampleTrack(J[0], k.T, {}); return [s.x - 9, s.y + 3.5, s.z + 26]; }, l: (u, k) => { const s = sampleTrack(J[0], k.T, {}); return [s.x + 6, s.y - 3, s.z - 170]; }, fov: [44, 40], hand: 0.8, shake: 0.05 }));
  shot(257.6, 260, 'ny', C({ p: [[-205, 434, -90], [-195, 431, -120]], l: [[-72, 424, -185], [-70, 421, -195]], fov: [40, 36], hand: 0.8, shake: 0.04 }));
  say('PIL', 255.2, 2.0, 'Contacts bearing zero-zero-five. Fox two! Fox two!', { radio: true });
  cue(254.2, 'riser', { dur: 5, g: 0.12 }); cue(258.5, 'stab', { m: 40, dur: 2.5, g: 0.15 });

  shot(260, 264, 'ny', C({ p: (u, k) => { const s = sampleTrack(J[2], Math.min(k.T, 260.5), {}); return [s.x + 12, s.y + 4, s.z + 26]; }, l: (u, k) => { const s = sampleTrack(J[2], Math.min(k.T, 260.5), {}); return [s.x, s.y, s.z - 10]; }, fov: [40, 52], hand: 0.8, shake: 0.12, shakeEnv: (lt) => (lt > 0.5 ? 1 : 0.3) }));
  say('PIL', 260.2, 2.4, 'I’m hit! Viper Two is hit— punching out—', { radio: true });
  cue(260.3, 'explosion', { s: 1.4 }, 'ny'); cue(261.6, 'scream', { g: 0.05 }, 'ny');

  /* ---- they're not even slowing down ---- */
  NY.gunTrack[6].push([[264, 20, 70, -520], [267, 0, 45, -250], [270, -6, 30, -40], [273, 10, 55, 160]]);
  NY.gunFire(6, 266.4, 268.6, [-2, 0, -140], 26);
  shot(264, 268.5, 'ny', C({ p: [[-4, 2.4, 20], [-4, 2.4, 14]], l: (u, k) => { const s = sampleTrack(NY.gunTrack[6][0], k.T, {}); return [s.x, s.y, s.z]; }, fov: [40, 52], hand: 0.5, shake: 0.04 }));
  say('RAD', 264.4, 3.6, 'Viper Two is down! They didn’t even slow down…', { radio: true });
  cue(265, 'rotor', { dur: 6, g: 0.3 }, 'ny');

  /* ---- tanks ---- */
  NY.tankPos = [
    { t0: 0, x: -8, z: 12, ry: Math.PI }, { t0: 0, x: -3, z: 12, ry: Math.PI }, { t0: 0, x: 3, z: 12, ry: Math.PI }, { t0: 0, x: 8, z: 12, ry: Math.PI },
    { t0: 0, x: -6, z: 28, ry: Math.PI }, { t0: 0, x: 6, z: 28, ry: Math.PI }, { t0: 0, x: 0, z: 40, ry: Math.PI },
  ];
  pb[0].seg(268, 0, -160, 282, 0, -62, 0); pb[0].hold(282, 300.5, 0, -62, 0);
  const tf = [[268.6, 0], [269.0, 3], [269.3, 1], [269.9, 5], [270.2, 2], [271.0, 4], [271.4, 6], [272.2, 0], [272.6, 3], [273.0, 5]];
  tf.forEach(([t, i]) => { NY.tankFire.push({ i, t }); cue(t, 'explosion', { s: 0.7 }, 'ny'); NY.fx.explosion(NY.tankPos[i].x, 2.5, NY.tankPos[i].z - 7, t, 0.5); });
  // return fire
  const kills = [[273.2, 2, 3.0], [274.4, 0, 3.0], [275.6, 4, 3.0], [276.6, 6, 3.0], [277.6, 1, 3.0], [278.6, 5, 3.0], [279.4, 3, 3.0]];
  kills.forEach(([t, i, s]) => { const tp = NY.tankPos[i]; NY.striderFire(0, t, [tp.x, 1.5, tp.z], { s: 2.8 }); NY.tankDead[i] = t + 0.25; NY.burn(tp.x, 1.5, tp.z, t + 0.3, 600, 1.1); });
  NY.tracers.burst([0, 1.4, 20], [0, 16, -100], 268.4, 276, 30, 5, 220);
  shot(268.5, 275, 'ny', C({ p: [[-5.5, 2.2, 30], [-5.5, 2.0, 24]], l: [[0, 12, -110], [0, 14, -92]], fov: [36, 34], hand: 0.5, shake: 0.03, shakeEnv: (lt) => (hash(Math.floor(lt * 7)) > 0.6 ? 1 : 0.2) }), {
    act: (k) => { const T = k.T; [0, 1, 2].forEach((i) => k.w.putSoldier(i, [-10, -9.5, 10][i], 0, [20, 33, 22][i], Math.PI + 0.1 * i, P.aim(T))); } });
  say('G', 270.2, 3.0, 'Hit it with everything! Concentrate fire on the center mass!', { radio: true });
  cue(268.5, 'autofire', { dur: 7, rate: 14, g: 0.1, f: 2000 }, 'ny'); cue(270.5, 'steps', { n: 8, dt: 0.68, g: 0.7 }, 'ny');

  shot(275, 281, 'ny', C({ p: [[-26, 24, -30], [-22, 26, -22]], l: [[0, 8, 10], [0, 8, 14]], fov: [50, 46], hand: 0.6, shake: 0.06 }));
  cue(275, 'steps', { n: 9, dt: 0.68, g: 0.7 }, 'ny'); say('G', 276.6, 3.2, 'Tank company is gone. I repeat— they don’t even slow down.', { radio: true });

  /* ---- gunships sweep the avenue ---- */
  NY.gunTrack[5].push([[281, -10, 62, -250], [286, 6, 36, -60], [291, 30, 44, 110]]);
  NY.gunTrack[7].push([[282, 34, 88, -300], [287, -12, 40, -90], [292, 0, 56, 120]]);
  NY.gunFire(5, 284.4, 287.4, [0, 0, 14], 26); NY.gunFire(7, 285.4, 288.4, [6, 0, 30], 26);
  [[285.2, 2, 1, 6], [286.0, -6, 1, 18], [286.8, 6, 1, 26], [287.6, -2, 1, 36]].forEach(([t, x0, y0, z0]) => NY.boom(t, x0, y0, z0, 1.3));
  shot(281, 288, 'ny', C({ p: [[-10, 1.6, 52], [-8, 1.7, 46]], l: [[0, 14, -40], [0, 24, -10]], fov: [44, 50], hand: 0.5, shake: 0.05 }), {
    act: (k) => { const T = k.T, w = k.w; for (let i = 0; i < 4; i++) w.putSoldier(i + 3, [-6, 4, -1, 7][i], 0, 38 - ((T - 281) * 7 + i * 4) % 40, 0, P.run(T * 11 + i, 1)); } });
  cue(284.2, 'autofire', { dur: 3, rate: 22, g: 0.2, f: 2400 }, 'ny'); cue(284, 'crowd', { n: 6, g: 0.08 }, 'ny');
  say('G', 289.2, 3.4, 'All units fall back to the river. We can’t—', { radio: true });

  shot(288, 294, 'ny', C({ p: [[-4, 1.4, 30], [-3, 1.5, 22]], l: [[0, 30, -90], [0, 24, -78]], fov: [30, 26], hand: 0.5 }), {
    act: (k) => { const T = k.T; k.w.putSoldier(7, 0, 0, 12, Math.PI, P.blend(P.idle(T), P.lookup(T), 0.9)); } });
  cue(291.8, 'static', { dur: 1.2, g: 0.15 }, 'ny'); cue(290, 'heartbeat', { n: 5 }, 'ny');

  shot(294, 300, 'ny', C({ p: [[0, 1.4, -20], [0, 1.4, -28]], l: [[0, 3, -62], [0, 15, -62]], fov: [28, 24], hand: 0.5 }), { fadeOut: 2.4 });
  NY.striderFire(0, 296.6, [-40, 70, -135], { s: 3.4 });
  NY.fx.dustBurst(-40, 90, -135, 297.8, 6, 20); NY.fx.dustBurst(-40, 6, -135, 300, 8, 28); NY.burn(-40, 3, -135, 300, 700, 2.4);
  cue(296, 'horn', { dur: 5, f: 46, g: 0.5 });
}
