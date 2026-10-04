import { C } from './cam.js';
import { P } from './models.js';
import { lerp, smooth, clamp, hash } from './util.js';
import { THEME } from './ch1.js';

export function ch6(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, title, memo, sp, flash, pb } = x;
  const NY = W.ny, SIT = W.sit;
  const N = Math.PI;

  chapter(515, 519.4, 'HOUR 07', 'Surrender · 02:50 EST');
  cue(515, 'tick');
  loc(521, 527, 'Situation Room — Washington, D.C.');

  /* ---------- the signing ---------- */
  const ring = (name, ang, r, pose, o) => SIT.put(name, Math.cos(ang) * r, 0, Math.sin(ang) * r, Math.atan2(-Math.cos(ang), -Math.sin(ang)), pose, o);
  const room = (k) => {
    const T = k.T, g = (key, amt = 0.8) => (sp(key, T) ? P.gesture(T, amt) : P.stand(T));
    ring('general', -1.45, 4.2, P.blend(P.stand(T), { hx: 0.3, sx: 0.12 }, 1)); ring('neuman', -0.45, 4.3, g('N', 0.9)); ring('edgar', -2.55, 4.15, g('E', 0.5)); ring('ashley', -2.95, 4.5, P.stand(T));
    ring('staff0', 0.55, 4.6, P.idle(T)); ring('staff1', 2.3, 4.7, P.idle(T)); ring('staff2', 2.9, 4.6, P.idle(T)); ring('staff3', -3.4, 4.6, P.idle(T));
  };
  shot(515, 523, 'sit', C({ p: [[1.2, 1.75, 7.2], [0.4, 1.6, 5.4]], l: [[-0.5, 1.5, -2.2], [-1.2, 1.5, -3]], fov: [42, 36], hand: 0.3 }), { act: (k) => { SIT.screenMode = 1; SIT.alarmOn = 0; room(k); }, holdBlack: 4.5, fadeIn: 1.2 });
  say('N', 519.9, 2.8, 'Stan, you can’t. We’re still standing.');
  say('E', 522.8, 3.6, 'We’re standing because they allow it. Seven hours. That is what the Seven bought us.');
  shot(523, 529, 'sit', C({ p: [[-0.2, 1.8, 1.2], [-0.9, 1.7, 0.3]], l: [[-3.4, 1.2, -2.4], [-3.4, 1.15, -2.4]], fov: [34, 26], hand: 0.3 }), {
    act: (k) => { room(k); const T = k.T; ring('edgar', -2.55, 4.15, P.blend(P.stand(T), { sx: 0.4, hx: 0.5, lax: 0.2, rax: 1.0, re: 1.3, raz: -0.3 }, 1)); SIT.screenMode = 1; } });
  say('E', 523.6, 2.0, 'I’ll sign.'); say('ADV', 526.0, 3.0, 'Compliance noted. Welcome to the Universal Union.', {});
  cue(523, 'bell', { m: 62, g: 0.12 }); cue(525, 'horn', { dur: 6, f: 46, g: 0.5 }, 'sit'); cue(528, 'hit', { g: 0.7 }); cue(515, 'melody', { notes: [[0, 57, 3], [1.6, 60, 3], [3.2, 64, 3.4]], g: 0.12 });

  /* ---------- Combine Earth ---------- */
  pb[4].hold(515, 600, -26, -150, 0); pb[5].hold(515, 600, 28, -230, 0);
  NY.dropTrack[0].push([[529, 200, 150, -440], [545, 80, 134, -270], [561, -30, 124, -110]]);
  NY.dropTrack[1].push([[529, -220, 144, -420], [545, -80, 128, -250], [561, 40, 118, -120]]);
  NY.dropTrack[2].push([[529, -20, 160, -520], [545, 20, 140, -300], [561, 10, 130, -90]]);
  NY.gunTrack[6].push([[529, -90, 100, -380], [545, 20, 70, -200], [561, 90, 90, -40]]); NY.gunTrack[7].push([[529, 120, 120, -400], [545, -10, 80, -210], [561, -80, 100, -50]]);
  shot(529, 540, 'ny', C({ p: [[0, 3, 60], [10, 56, 20]], l: [[10, 70, -420], [40, 250, -760]], fov: [50, 46], hand: 0.3 }), { fadeIn: 0.8 });
  loc(529.6, 535, 'New York City — 02:52 EST');
  say('ADV', 530.2, 4.4, 'Seven hours. Earth is now a province of the Universal Union.'); cue(529, 'horn', { dur: 7, f: 44, g: 0.5 }); cue(529, 'dropship', { dur: 30, g: 0.25 }, 'ny'); cue(532, 'steps', { n: 4, dt: 0.9, g: 0.4 }, 'ny');
  cue(529, 'portal', { dur: 12, g: 0.2 });

  /* ---------- survivors ---------- */
  NY.capeHoldOn = true; NY.lighterOn = true;
  const grp = (k, o = {}) => {
    const T = k.T, w = k.w;
    w.put('starlight', -1.6, 0, -30, N, P.blend(P.idle(T), { lax: 0.9, le: 1.3, rax: 0.3, hx: -0.1 }, 1)); w.actors.starlight.face(-0.5);
    w.put('butcher', 0.7, 0, -30.4, N, x.sp('BU', T) ? P.gesture(T, 0.6) : P.idle(T)); w.put('hughie', -3.3, 0, -29.6, N, P.idle(T)); w.put('mm', 3.0, 0, -29.8, N, P.arms_crossed(T));
    w.put('kimiko', -5, 0, -30.2, N, P.blend(P.idle(T), { rax: 0.6, re: 1.6 }, 1));
  };
  shot(540, 548, 'ny', C({ p: [[-1, 1.5, -22], [-1, 1.6, -25.5]], l: [[0, 40, -400], [0, 100, -520]], fov: [46, 40], hand: 0.3 }), { act: grp });
  say('HU', 541, 2.6, 'Seven hours. That’s all it took.'); say('BU', 544.0, 3.9, 'Seven for them. We’ve been fighting a monster for years. This one’s just taller.');
  shot(548, 556, 'ny', C({ p: [[-4.2, 1.5, -39], [-1.4, 1.55, -38]], l: [[-0.8, 1.35, -30], [-1.0, 1.4, -30]], fov: [32, 28], hand: 0.3 }), { act: grp });
  say('S', 548.8, 3.2, 'He was the strongest person alive. And they didn’t even slow down.'); say('MM', 552.2, 1.8, 'So we don’t fight like him.'); say('BU', 554.0, 2.0, 'Right. We fight like us.');
  cue(548, 'melody', { notes: [[0, 62, 3], [1.5, 65, 3], [3, 69, 3.6]], g: 0.13 });

  /* ---------- in memoriam ---------- */
  const dead = (k) => {
    const w = k.w;
    w.put('atrain', -8.3, 0.3, -104, 1.0, P.dead()); w.put('noir', -2.2, 0, -26.4, N, P.dead()); w.put('deep', -2.2, 0, -33.8, 0.6, P.dead()); w.put('soldierboy', 0, 0, -43, N, P.dead()); w.put('maeve', -3.6, 0, -37.4, 1.9, P.dead());
  };
  const memoShot = (t0, t1, name, sub, cam) => { shot(t0, t1, 'ny', C({ hand: 0.4, ...cam }), { act: dead }); memo(t0 + 0.3, t1 - 0.2, name, sub); };
  memoShot(556, 559, 'A-TRAIN', 'Reggie Franklin', { p: [[-3.6, 1.0, -97], [-4.6, 1.1, -99]], l: [-8.3, 0.5, -104], fov: [34, 30] });
  memoShot(559, 562, 'BLACK NOIR', '', { p: [[1.8, 0.9, -23], [1.2, 1.0, -24.2]], l: [-2.2, 0.4, -26.4], fov: [34, 30] });
  memoShot(562, 565, 'THE DEEP', 'Kevin Moskowitz', { p: [[1.6, 0.9, -30], [1.0, 1.0, -31]], l: [-2.2, 0.4, -33.8], fov: [34, 30] });
  memoShot(565, 568, 'SOLDIER BOY', 'Ex-Payback', { p: [[3.6, 1.0, -39], [3.0, 1.0, -40]], l: [0, 0.5, -43], fov: [34, 30] });
  memoShot(568, 571, 'QUEEN MAEVE', 'Maeve', { p: [[-0.4, 1.0, -33.8], [-1.0, 1.1, -34.8]], l: [-3.6, 0.4, -37.4], fov: [34, 30] });
  shot(571, 574, 'ny', C({ p: [[-3.2, 0.9, -27], [-3.8, 0.95, -28]], l: [[-5.0, 1.0, -30.2], [-5.0, 1.0, -30.2]], fov: [26, 20], hand: 0.4 }), { act: grp });
  memo(571.3, 573.8, 'FRENCHIE', 'Serge');
  cue(556, 'melody', { notes: [[0, 62, 3], [1.5, 65, 3], [3, 69, 3.4], [5, 67, 2], [6.4, 65, 2], [7.8, 64, 2], [9.2, 62, 4]], g: 0.16, type: 'triangle' });
  cue(566, 'melody', { notes: [[0, 50, 4], [2, 53, 4], [4, 57, 5]], g: 0.1, type: 'sine' });

  /* ---------- the war goes on ---------- */
  shot(574, 584, 'ny', C({ p: [[-2.6, 1.45, -26.6], [-2.2, 1.5, -27.6]], l: [[-1.6, 1.42, -30], [-1.5, 1.46, -30]], fov: [32, 26], hand: 0.4 }), { act: grp });
  memo(574.4, 577.6, 'HOMELANDER', 'John');
  say('S', 578.2, 3.0, 'Whatever they are — whatever comes next…'); say('BU', 581.4, 2.8, 'Aye. Tomorrow, we start the war.');
  const walkAway = (k) => { const T = k.T, lt = k.lt; const z = -30 - lt * 0.9; const ph = lt * 4.4;
    k.w.put('butcher', 0.5, 0, z - 0.2, N, P.walk(ph, 0.6)); k.w.put('hughie', -2.4, 0, z + 0.2, N, P.walk(ph + 1, 0.6)); k.w.put('mm', 2.8, 0, z, N, P.walk(ph + 2, 0.6)); k.w.put('kimiko', -4.2, 0, z - 0.1, N, P.walk(ph + 0.5, 0.6)); k.w.put('starlight', -1.0, 0, z + 0.1, N, P.walk(ph + 1.7, 0.55)); };
  shot(584, 600, 'ny', C({ p: [[0, 1.2, -18], [0, 14, -26]], l: [[0, 30, -420], [0, 150, -600]], fov: [40, 36], hand: 0.2 }), { act: (k) => { NY.capeHoldOn = true; walkAway(k); }, fadeOut: 3.4 });
  title(592.6, 598.6, 'SEVEN HOURS', 'The Resistance Begins');
  cue(584, 'melody', { notes: THEME.map(([a, b, c]) => [a, b, c]), g: 0.15, type: 'triangle' }); cue(592.4, 'hit', { g: 0.7 }); cue(584, 'portal', { dur: 14, g: 0.12 });
}
