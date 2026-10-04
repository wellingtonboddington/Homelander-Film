import { C } from './cam.js';
import { P, Human } from './models.js';
import { sampleTrack } from './common.js';
import { lerp, smooth, clamp, hash } from './util.js';
import { glowSprite } from './fx.js';

export function ch5(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, flash, pb, sp } = x;
  const NY = W.ny;
  const at = (keys, t) => { const s = sampleTrack(keys, t, {}); return [s.x, s.y, s.z]; };
  const N = Math.PI; // facing north (-z)

  chapter(410, 414.4, 'HOUR 06', 'The Seven · 01:50 EST');
  cue(410, 'tick');

  /* ---------- Strider paths ---------- */
  pb[0].seg(410, 0, -198, 423.2, 0, -110, 0);
  pb[1].seg(410, -22, -206, 436, -18, -140, 0); pb[1].seg(436, -18, -140, 452.5, -18, -100, 0); pb[1].hold(452.5, 470, -18, -100, 0);
  pb[2].seg(410, 24, -214, 440, 22, -150, 0); pb[2].seg(440, 22, -150, 464, 16, -84, 0); pb[2].seg(464, 16, -84, 475.3, 10, -56, 0); pb[2].hold(475.3, 520, 10, -56, 0);
  pb[3].hold(478, 490, 0, -175, 0); pb[3].seg(490, 0, -175, 497.4, 0, -130, 0); pb[3].hold(497.4, 560, 0, -130, 0);
  NY.sDrop[3] = { t0: 479, t1: 488, h: 520 };
  NY.sDead[0] = { t: 423.3, keep: true }; NY.sDead[1] = { t: 452.4, keep: true }; NY.sDead[2] = { t: 475.3, keep: true }; NY.sDead[3] = { t: 497.6, keep: true };
  NY.striderFire(1, 413.9, [-40, 70, -175], { s: 3.4 }); NY.striderFire(2, 416.8, [38, 90, -190], { s: 2.6 });
  NY.fx.dustBurst(-40, 100, -175, 415.8, 6, 20); NY.fx.dustBurst(-40, 6, -175, 418, 8, 28); NY.burn(-40, 3, -175, 418, 700, 2.8); NY.burn(38, 40, -190, 417.5, 700, 1.6);
  cue(414.5, 'glass', {}, 'ny'); cue(415.2, 'thunder', { dur: 3.5, g: 0.7 });

  /* ---------- formation ---------- */
  const ses = { homelander: [0, -33.5], starlight: [-3.2, -30.2], maeve: [3.2, -30.2], atrain: [-6.4, -29.2], noir: [6.6, -29.2], soldierboy: [-9.8, -28.4] };
  const formation = (k, skip = []) => {
    const T = k.T, w = k.w;
    for (const n in ses) { if (skip.includes(n)) continue; const [px, pz] = ses[n];
      const pose = n === 'soldierboy' ? P.arms_crossed(T) : n === 'noir' ? P.hero(T) : P.hero(T);
      w.put(n, px, 0, pz, N, pose, { flow: 0.25, wind: 1.3, scorch: 0 }); }
  };
  shot(410, 420, 'ny', C({ p: [[0, 1.35, -17], [0, 1.65, -21.5]], l: [[0, 9.5, -200], [0, 11, -190]], fov: [42, 36], hand: 0.3 }), { act: formation, holdBlack: 4.4, fadeIn: 1.2 });
  say('H', 412.4, 2.8, 'Seven of us. Let them look.'); say('SB', 415.4, 2.2, 'Big. I like big.'); say('S', 417.8, 2.2, 'Has anyone seen Kevin?');
  cue(410.5, 'horn', { dur: 5, f: 47, g: 0.5 }); cue(411, 'steps', { n: 8, dt: 0.62, g: 0.45 }, 'ny'); cue(410, 'riser', { dur: 10, g: 0.1 }); cue(416, 'rotor', { dur: 6, g: 0.1 }, 'ny');

  /* ---------- A-Train ---------- */
  const aT0 = 422.0, aT1 = 422.95; const aPos = (T) => { const u = clamp((T - aT0) / (aT1 - aT0)); return [-8.3, lerp(0, 2.2, u), lerp(-34, -106, u)]; };
  shot(420, 421.8, 'ny', C({ p: [[-3.5, 1.1, -26], [-4.0, 1.15, -28]], l: [[-7.8, 1.0, -34], [-8.2, 1.0, -34.6]], fov: [34, 28], hand: 0.3 }), {
    act: (k) => { formation(k, ['atrain']); k.w.put('atrain', -8.3, 0, -34.8, N, P.crouchAim(k.T)); k.w.actors.atrain.pose({ ry: -0.4, rx: 0.35, sx: 0.25, lax: 0.9, rax: -0.6, le: 1.2, re: 1.2, llh: 1.1, rlh: -0.5, lk: 1.4, rk: 0.4 }); } });
  say('M', 420.1, 1.6, '…Not since the pods.'); say('A', 420.9, 1.0, 'Nobody falls.');
  const sprintTrail = (u) => { const p = aPos(aT0 + u * (aT1 - aT0)); return [p[0] + 0.3, p[1] + 1.0, p[2]]; };
  NY.fx.trail(sprintTrail, aT0, aT1 + 0.1, 40, 1.2, [0.8, 0.95, 1, 0.9], [0.3, 0.6, 1, 0], 0.9);
  NY.beams.add({ a: [-8.3, 1.0, -34], b: [-8.3, 1.4, -106], t0: aT0, dur: 1.0, w: 0.35, color: 0x9fd8ff, opacity: 0.8 });
  NY.striderFire; NY.boom(aT1, -8.3, 3, -106, 2.6); NY.fx.dustBurst(-8.3, 1, -106, aT1, 5, 26); NY.flashL.add(-8.3, 4, -104, aT1, 0.8, 5000, 0xdfeeff);
  cue(aT0 - 0.15, 'whoosh', { dur: 1.0, g: 0.5 }, 'ny'); cue(aT1, 'hit', { g: 0.9 }); cue(aT1 + 0.3, 'steps', { n: 2, dt: 0.5, g: 0.8 }, 'ny');
  shot(421.8, 423.3, 'ny', C({ p: (u, k) => { const a = aPos(k.T); return [3.5, 1.5, a[2] + 7]; }, l: (u, k) => aPos(k.T), fov: [48, 62], hand: 0.2, shake: 0.08 }), {
    act: (k) => { formation(k, ['atrain']); const T = k.T; if (T < aT1) k.w.put('atrain', ...aPos(T), N, P.sprint(T * 34)); else k.w.put('atrain', -8.3, 0.3, -106, N, P.die(clamp((T - aT1) / 0.5))); } });
  say('H', 421.8, 1.2, 'A-Train, wait—');

  shot(423.3, 428, 'ny', C({ p: [[26, 7, -92], [30, 9, -88]], l: [[-2, 10, -112], [-4, 8, -110]], fov: [42, 40], hand: 0.5, shake: 0.12, shakeEnv: (lt) => Math.exp(-lt * 0.8) }), {
    act: (k) => { formation(k, ['atrain']); k.w.put('atrain', -8.3, 0.3, -104, 1.0, P.dead()); } });
  NY.fx.dustBurst(-6, 2, -110, 424.2, 7, 26); NY.fx.dustBurst(-2, 2, -116, 425.4, 6, 20); NY.boom(424.4, 0, 12, -112, 1.8); cue(424.0, 'stomp', { g: 1.2 }, 'ny'); cue(425.4, 'explosion', { s: 1.2 }, 'ny');
  loc(424.6, 428.6, 'A-Train — killed in action');
  say('S', 424.9, 1.8, '…Reggie?'); say('H', 426.5, 1.8, 'He took one down.');

  /* ---------- Black Noir ---------- */
  const gK = [[427.5, 0, 126, -430], [430, -3, 64, -170], [432.0, -3, 24, -46], [433.0, -4, 20, -22]]; NY.gunTrack[0].push(gK);
  NY.gunFire(0, 430.2, 432.9, [-3.2, 0.5, -27.5], 28);
  NY.beams.add({ a: [7.8, 1.9, -17.8], b: at(gK, 433.0), t0: 432.95, dur: 0.6, w: 0.14, color: 0xff3a2a, opacity: 1 }); NY.beams.add({ a: [8.1, 1.9, -17.8], b: at(gK, 433.0), t0: 432.95, dur: 0.6, w: 0.14, color: 0xff3a2a, opacity: 1 });
  NY.boom(433.4, ...at(gK, 433.0), 2.4); NY.boom(433.8, ...at(gK, 433.0).map((v, i) => v + [4, -8, 3][i]), 1.4); NY.fx.burn(-4, 1, -26, 433.6, 700, 0.7);
  shot(428, 433, 'ny', C({ p: [[3.4, 1.0, -17], [1.6, 1.15, -19.5]], l: (u, k) => (k.T < 431.2 ? [0, lerp(18, 7, clamp((k.T - 428) / 3.2)), lerp(-95, -50, clamp((k.T - 428) / 3.2))] : [-2.4, 1.0, -27]), fov: [60, 48], hand: 0.4, shake: 0.04 }), {
    act: (k) => { const T = k.T, w = k.w;
      w.put('starlight', -3.4, 0, -28.2, N, P.cower(T)); w.put('maeve', 1.4, 0, -33, N, P.hero(T), { flow: 0.2 }); w.put('homelander', 8, 0, -18, N, P.hero(T), { flow: 0.3, heat: T > 432.9 });
      const nx = lerp(6.6, -2.0, smooth((T - 429.4) / 1.6)); const nz = lerp(-29.2, -26.2, smooth((T - 429.4) / 1.6));
      if (T < 432.25) w.put('noir', nx, 0, nz, N, T < 431.1 ? P.run(T * 10, 1) : P.hero(T)); else w.put('noir', -2, 0, -26.4, N, P.die(clamp((T - 432.25) / 0.7)));
      w.put('soldierboy', -9.8, 0, -28.4, N, P.arms_crossed(T)); } });
  cue(428, 'rotor', { dur: 6, g: 0.3 }, 'ny'); cue(430.2, 'crowd', { n: 4, g: 0.06 }, 'ny'); cue(432.9, 'laser', { dur: 0.6, g: 0.25 }, 'ny'); cue(432.3, 'hit', { g: 0.6 });

  shot(433, 438, 'ny', C({ p: [[-6.6, 1.1, -22.5], [-5.0, 1.3, -23.5]], l: [[-2.6, 0.7, -26.4], [-2.2, 0.9, -26.6]], fov: [38, 30], hand: 0.5 }), {
    act: (k) => { const T = k.T, w = k.w; w.put('noir', -2.2, 0, -26.4, N, P.dead()); w.put('starlight', -3.2, 0, -24.8, N + 0.4, P.kneel(T)); w.put('homelander', 0.4, 0, -23.8, N + 0.6, P.hero(T), { flow: 0.15, scorch: 0.3 }); w.actors.homelander.face(-0.4); } });
  loc(433.6, 437.8, 'Black Noir — killed in action');
  say('H', 434.6, 1.6, 'Noir. Get up.'); say('H', 436.4, 1.6, 'That’s an order.');
  cue(433, 'melody', { notes: [[0, 57, 3], [1.5, 60, 3], [3, 64, 3.5]], g: 0.14, type: 'triangle' });

  /* ---------- The Deep ---------- */
  const zdz = (T) => lerp(-62, -34, clamp((T - 438) / 6.8));
  shot(438, 442.5, 'ny', C({ p: [[-6.4, 1.3, -22], [-5.4, 1.4, -24]], l: [[-1, 1.4, -48], [-1.5, 1.4, -46]], fov: [32, 30], hand: 0.4 }), {
    act: (k) => { const T = k.T, w = k.w, lt = k.lt;
      w.put('starlight', -3.4, 0, -28, N, P.idle(T)); w.put('maeve', 2.5, 0, -28.5, N, P.idle(T), {});
      w.put('zdeep', -1.2, 0, zdz(T), 0 + Math.sin(lt) * 0.1, P.zombie(lt * 3.2));
      [[-6, -66], [4, -72], [-2, -80], [8, -76]].forEach(([zx, zz], i) => w.putZ(i, zx, 0, zz + lt * 0.9 * (1 + i * 0.1), 0, P.zombie(lt * 3 + i * 1.3)));
      w.zdeep.face(-0.8); } });
  say('S', 439.0, 1.6, 'Kevin?'); say('M', 441.0, 1.5, 'Annie… that’s not him.');
  cue(438, 'moan', { dur: 2.4, g: 0.16, f: 96 }, 'ny'); cue(440.5, 'moan', { dur: 2.2, g: 0.14, f: 80 }, 'ny'); cue(439, 'crabs', { n: 4, dt: 0.6, g: 0.06 }, 'ny');
  NY.beams.add({ a: [-3.4, 1.4, -28.8], b: [-2.0, 1.6, -33.6], t0: 445.3, dur: 0.5, w: 0.2, color: 0xfff4b0 }); NY.flashL.add(-2.5, 1.7, -31, 445.3, 0.6, 1800, 0xfff0a0); NY.fx.explosion(-2, 1.6, -33.8, 445.4, 0.6);
  shot(442.5, 447, 'ny', C({ p: [[-4.2, 1.65, -42.6], [-4.0, 1.6, -41.0]], l: [[-3.2, 1.45, -28], [-3.2, 1.5, -28]], fov: [30, 26], hand: 0.4 }), {
    act: (k) => { const T = k.T, w = k.w, lt = k.lt;
      w.put('starlight', -3.2, 0, -28, 0, T > 445.1 && T < 446 ? P.blend(P.idle(T), P.aim(T), 1) : P.idle(T)); w.actors.starlight.face(T > 445.3 ? -0.9 : -0.2);
      if (T < 445.5) w.put('zdeep', -2.3, 0, lerp(-48, -31.6, clamp((T - 442.5) / 2.6)), 0, P.zombie(lt * 3.4)); } });
  say('S', 443.7, 1.4, 'I’m so sorry, Kevin.');
  cue(445.2, 'zap', { dur: 0.6, g: 0.4 }, 'ny'); cue(442.6, 'moan', { dur: 2.2, g: 0.18, f: 90 }, 'ny'); cue(445.6, 'melody', { notes: [[0, 62, 3], [1.4, 65, 3]], g: 0.12 });
  loc(445.6, 449.6, 'The Deep — killed in action');

  /* ---------- Soldier Boy ---------- */
  const sbGlow = glowSprite(0x9fd8ff, 3.2, 0); sbGlow.position.set(0, 0.34, 0.2); NY.actors.soldierboy.spine.add(sbGlow);
  NY.sbGlow = sbGlow;
  const s1b = [-18, 17, -99.5];
  NY.beams.add({ a: [0, 1.5, -42.2], b: s1b, t0: 450.8, dur: 1.4, w: 1.1, color: 0xbfe6ff, opacity: 0.95 }); NY.beams.add({ a: [0, 1.5, -42.2], b: s1b, t0: 450.8, dur: 1.4, w: 2.6, color: 0x5ab6ff, opacity: 0.35 });
  NY.boom(451.6, ...s1b, 3.6, { blue: true }); NY.boom(452.1, -18, 8, -100, 2.6, { blue: true });
  NY.striderFire(2, 453.7, [0, 1.6, -42.5], { s: 3 });
  NY.fx.dustBurst(-18, 2, -100, 452.6, 6, 24);
  const sbAct = (k, dead) => {
    const T = k.T, w = k.w;
    const charge = clamp((T - 448.4) / 2.4); sbGlow.material.opacity = T > 454 ? 0 : charge; sbGlow.scale.setScalar(1.4 + charge * 3.4 + Math.sin(T * 40) * 0.2);
    w.put('starlight', -3.4, 0, -33.5, N, P.cower(T)); w.put('maeve', 3, 0, -33.8, N, P.crouchAim(T));
    if (!dead) w.put('soldierboy', 0, 0, -42.6, N, P.blend(P.hero(T), { rx: -0.1, sx: -0.3, hx: -0.3, lax: 0.2, rax: 0.2, laz: 0.9, raz: 0.9, le: 0.4, re: 0.4 }, charge));
    else w.put('soldierboy', 0, 0, -43, N, P.dead());
  };
  shot(447, 454.1, 'ny', C({ p: [[-2.2, 1.6, -36], [-1.0, 1.7, -39]], l: [[-11, 12, -98], [-12, 13, -96]], fov: [36, 30], hand: 0.4, shake: 0.05, shakeEnv: (lt) => (lt > 3.4 ? 1 : 0.2) }), { act: (k) => sbAct(k, false) });
  say('SB', 447.6, 2.2, 'Fall back. This one’s mine.'); say('SB', 452.5, 1.5, 'That all you’ve got?!');
  cue(449, 'riser', { dur: 3, g: 0.2 }); cue(450.8, 'beam', { dur: 1.6 }, 'ny'); cue(450.8, 'laser', { dur: 1.4, g: 0.3 }, 'ny');
  flash(454.0, 0.6);
  shot(454.1, 458, 'ny', C({ p: [[-4.0, 1.5, -34], [-3.0, 1.6, -36]], l: [[0, 0.5, -43], [0.4, 0.6, -43]], fov: [34, 30], hand: 0.5 }), { act: (k) => sbAct(k, true) });
  loc(454.8, 458.6, 'Soldier Boy — killed in action'); cue(454.1, 'hit', { g: 0.8 });

  /* ---------- Queen Maeve ---------- */
  NY.striderFire(2, 457.6, [-40, 60, -95], { s: 3.2 }); NY.fx.dustBurst(-40, 60, -95, 458.4, 6, 20); NY.fx.dustBurst(-40, 6, -95, 460, 8, 26); NY.burn(-40, 3, -95, 460, 700, 2.4);
  const mp = [-1.2, -38.4], sp0 = [-3.8, -37.2];
  shot(458, 464, 'ny', C({ p: [[0.4, 1.55, -33], [-0.2, 1.6, -34.6]], l: [[-1.6, 1.5, -39], [-2.2, 1.55, -39]], fov: [34, 30], hand: 0.4 }), {
    act: (k) => { const T = k.T, w = k.w;
      w.put('maeve', mp[0], 0, mp[1], N + 0.5, x.sp('M', T) ? P.gesture(T, 0.5) : P.idle(T)); w.put('starlight', sp0[0], 0, sp0[1], N - 0.4, P.idle(T)); w.actors.maeve.face(-0.2); } });
  say('M', 458.6, 2.0, 'Annie. Run.'); say('S', 460.8, 1.8, 'Not without you.'); say('M', 462.6, 1.4, 'I’m not asking.');
  cue(458, 'melody', { notes: [[0, 57, 2.5], [2, 60, 2.5], [4, 64, 3]], g: 0.12 });

  NY.striderFire(2, 466.0, [-3.6, 1.2, -37.4], { s: 3.2 });
  shot(464, 470, 'ny', C({ p: [[-6.4, 1.5, -30], [-5, 1.6, -31.5]], l: [[0, 6, -50], [-1.5, 3, -42]], fov: [40, 36], hand: 0.5, shake: 0.2, shakeEnv: (lt) => (lt > 1.9 ? Math.exp(-(lt - 1.9) * 1.2) : 0.05) }), {
    act: (k) => { const T = k.T, w = k.w;
      const u = smooth((T - 464.6) / 1.3);
      if (T < 466.0) { w.put('maeve', lerp(-1.2, -3.6, u), 0, lerp(-38.4, -37.4, u), N - 0.9, T < 464.6 ? P.idle(T) : P.run(T * 10, 1)); w.put('starlight', sp0[0] - u * 0.4, 0, sp0[1] + u * 0.6, N - 0.4, P.hurt(u)); }
      else w.put('starlight', -5.2, 0, -35.2, N, P.dead()); } });
  cue(464.4, 'whoosh', { dur: 0.8, g: 0.3 }, 'ny'); cue(466.3, 'scream', { g: 0.2 }, 'ny'); cue(466.2, 'hit', { g: 0.9 });
  loc(467.2, 471, 'Queen Maeve — killed in action');

  /* ---------- Homelander v. Strider ---------- */
  const hk = [[470, -34, 80, 44], [472.2, -14, 42, -12], [473.6, 4, 22, -44], [474.5, 6, 18.5, -53], [475.4, 6, 18, -57]];
  const hp = (T) => at(hk, T);
  const s2h = [10, 17.8, -56];
  NY.beams.add({ a: [...hp(473.4).map((v, i) => v + [0.12, 0, 0][i])], b: [9, 17.6, -62], t0: 473.4, dur: 0.9, w: 0.14, color: 0xff3a2a, opacity: 1 });
  NY.beams.add({ a: [...hp(473.4).map((v, i) => v + [-0.12, 0, 0][i])], b: [9, 17.6, -62], t0: 473.4, dur: 0.9, w: 0.14, color: 0xff3a2a, opacity: 1 });
  NY.boom(474.1, 9.5, 17.5, -60, 1.6); NY.boom(474.9, ...s2h, 3.8); NY.boom(475.3, 10, 9, -56, 3.2); NY.fx.dustBurst(10, 2, -56, 476, 7, 26); NY.burn(10, 3, -56, 476, 700, 2.2);
  shot(470, 475.5, 'ny', C({ p: [[-44, 36, 6], [-40, 30, -4]], l: (u, k) => { const h = hp(Math.min(k.T, 475.2)); return [lerp(h[0], 10, 0.55), lerp(h[1], 17, 0.55), lerp(h[2], -57, 0.55)]; }, fov: [48, 44], hand: 0.4, shake: 0.06, shakeEnv: (lt) => (lt > 3.6 ? 1 : 0.3) }), {
    act: (k) => { const T = k.T, w = k.w; const h = hp(Math.min(T, 475.4)); w.put('homelander', h[0], h[1], h[2], N, T < 474.5 ? P.fly(T, 0) : P.punch(clamp((T - 474.5) / 0.9)), { flow: 0.8, heat: T > 473.4 && T < 474.4, scorch: 0.6 }); w.actors.homelander.face(-0.6);
      w.put('starlight', -5.2, 0, -35.2, N, P.dead()); } });
  cue(470.2, 'whoosh', { dur: 2, g: 0.45 }, 'ny'); cue(473.4, 'laser', { dur: 0.9, g: 0.3 }, 'ny'); cue(474.8, 'hit', { g: 1 }); cue(470, 'riser', { dur: 4.4, g: 0.15 });

  shot(475.5, 481, 'ny', C({ p: [[-3.2, 1.5, -43], [-1.6, 1.6, -41.6]], l: [[0.6, 1.45, -50], [0.6, 1.5, -50]], fov: [36, 30], hand: 0.5, shake: 0.03 }), {
    act: (k) => { const T = k.T, w = k.w; w.put('homelander', 0.6, 0, -50.4, 0.2, T < 477 ? P.blend(P.hero(T), P.kneel(T), 0.7) : P.hero(T), { flow: 0.12, scorch: 0.8 }); w.actors.homelander.face(-0.7);
      w.put('starlight', -4.0, 0, -46, N, P.blend(P.kneel(T), P.idle(T), clamp((T - 477) / 2))); } });
  say('H', 476.6, 1.8, 'Get behind me.'); say('S', 478.6, 2.0, 'John— look at the sky.');
  cue(475.5, 'stomp', { g: 1.0 }, 'ny');

  /* ---------- the offer ---------- */
  NY.dropTrack[0].push([[480, -90, 170, -440], [490, -40, 125, -240], [500, 10, 104, -120]]);
  NY.dropTrack[1].push([[481, 100, 196, -470], [491, 46, 130, -270], [501, 14, 100, -160]]);
  const gk3 = [[484, -140, 130, -320], [494, -60, 82, -140], [499, -40, 70, -80]], gk4 = [[484, 140, 140, -330], [494, 70, 88, -150], [499, 40, 72, -90]], gk5 = [[486, 20, 150, -380], [495, 10, 90, -170], [499, 10, 74, -100]];
  NY.gunTrack[3].push(gk3); NY.gunTrack[4].push(gk4); NY.gunTrack[5].push(gk5);
  NY.fx.dustBurst(0, 1, -175, 488.2, 4, 30); NY.flashL.add(0, 4, -171, 488.2, 0.9, 5000, 0x9fe0ff);
  const front = (k, o = {}) => { const T = k.T, w = k.w; w.put('homelander', 0.4, 0, -48, N, P.blend(P.hero(T), { hx: 0.15, sx: 0.08 }, 0.5), { flow: 0.15, scorch: 0.9 }); w.put('starlight', -3.8, 0, -45, N + 0.5, P.kneel(T)); w.actors.homelander.face(o.smile ?? -0.3); };
  shot(481, 487, 'ny', C({ p: [[-1.0, 1.1, -43], [0.4, 1.4, -44.5]], l: [[0, 28, -140], [0, 20, -150]], fov: [44, 38], hand: 0.3 }), { act: front });
  say('ADV', 481.6, 3.4, 'Specimen designation: superior. Your biology is… remarkable.'); cue(479, 'horn', { dur: 6, f: 44, g: 0.5 }); cue(479, 'portal', { dur: 10, g: 0.3 }); cue(488.2, 'stomp', { g: 1.2 }, 'ny');
  cue(480, 'dropship', { dur: 20, g: 0.3 }, 'ny');
  shot(487, 493, 'ny', C({ p: [[3.2, 1.65, -42], [2.0, 1.68, -43.2]], l: [[0.4, 1.7, -48], [0.4, 1.72, -48]], fov: [28, 22], hand: 0.3 }), { act: (k) => front(k, { smile: 0.35 }) });
  say('ADV', 487.2, 3.8, 'The Union does not destroy what it can use. Kneel, and be elevated beyond your kind.'); say('S', 491.2, 1.8, 'John… they’ll make you a thing.');

  /* ---------- the last stand ---------- */
  const hk2 = [[494.6, 0.4, 1.0, -48], [495.4, 0, 8, -80], [496.8, 0, 17, -122], [497.6, 0, 18, -130.5], [499, 0, 40, -150]];
  const hk3 = [[498.8, 0, 30, -150], [500.4, -8, 160, -240], [502.6, -16, 380, -330], [504.5, -20, 640, -420]];
  NY.striderFire(3, 496.2, [0.4, 1.6, -50], { s: 2.2, noBoom: true });
  NY.beams.add({ a: [0, hk2[2][2] * 0 + 17.8, -121], b: [0, 18, -129], t0: 496.9, dur: 0.7, w: 0.14, color: 0xff3a2a, opacity: 1 });
  NY.boom(497.6, 0, 18, -130.5, 4.2); NY.boom(497.9, 0, 9, -130, 3.4); NY.fx.dustBurst(0, 2, -130, 498.4, 7, 26); NY.burn(0, 3, -130, 498.4, 700, 2.4);
  [[498.4, gk3], [498.9, gk4], [498.98, gk5]].forEach(([t, key]) => { NY.boom(t, ...at(key, t), 2.2); NY.beams.add({ a: at(hk2, 498.3), b: at(key, t), t0: t - 0.3, dur: 0.4, w: 0.12, color: 0xff3a2a, opacity: 1 }); });
  shot(493, 498.8, 'ny', C({ p: [[-4.4, 1.5, -38], [-6, 3.5, -64]], l: (u, k) => { const h = at(hk2, Math.max(k.T, 494.6)); return [h[0], Math.max(h[1], 1.6), h[2] - 2]; }, fov: [40, 44], hand: 0.5, shake: 0.06, shakeEnv: (lt) => (lt > 3 ? 1 : 0.2) }), {
    act: (k) => { const T = k.T, w = k.w;
      w.put('starlight', -3.8, 0, -45, N, P.kneel(T));
      if (T < 494.6) w.put('homelander', 0.4, 0, -48, N, P.hero(T), { flow: 0.2, scorch: 0.9 }); else { const h = at(hk2, T); w.put('homelander', h[0], h[1], h[2], N, P.fly(T, 0), { flow: 0.85, heat: T > 496.8 && T < 497.6, scorch: 0.9 }); } } });
  say('H', 493.4, 1.6, 'I don’t kneel.'); say('H', 495.0, 1.4, 'They kneel to me.');
  cue(495.2, 'whoosh', { dur: 1.6, g: 0.5 }, 'ny'); cue(496.2, 'strider_fire', {}, 'ny'); cue(496.9, 'laser', { dur: 0.8, g: 0.3 }, 'ny'); cue(493, 'riser', { dur: 4.6, g: 0.18 });

  NY.beams.add({ a: [-20, 690, -430], b: at(hk3, 504.5), t0: 504.25, dur: 0.9, w: 11, color: 0xcff0ff, opacity: 0.95 }); NY.beams.add({ a: [-20, 690, -430], b: at(hk3, 504.5), t0: 504.25, dur: 0.9, w: 26, color: 0x6fd0ff, opacity: 0.35 });
  NY.boom(504.6, ...at(hk3, 504.5), 14, { blue: true });
  shot(498.8, 505, 'ny', C({ p: (u, k) => { const h = at(hk3, Math.min(k.T, 504.6)); return [h[0] + 7, h[1] - 14, h[2] + 34]; }, l: (u, k) => at(hk3, Math.min(k.T, 504.6)), fov: [46, 38], hand: 0.5, shake: 0.08 }), {
    act: (k) => { const T = k.T; if (T < 504.5) { const h = at(hk3, T); k.w.put('homelander', h[0], h[1], h[2], N, P.fly(T, 0), { flow: 0.9, scorch: 1 }); k.w.actors.homelander.face(-0.8); } } });
  cue(498.8, 'whoosh', { dur: 4, g: 0.5 }, 'ny'); cue(498.8, 'riser', { dur: 5.6, g: 0.22 }); cue(504.3, 'beam', { dur: 1.2 }, 'ny'); cue(504.4, 'hit', { g: 1.4 }); flash(504.5, 1.4);

  /* ---------- the cape ---------- */
  NY.capeFn = (T) => (T < 505 || T > 516 ? null : (() => { const u = clamp((T - 505.6) / 6.2); const e = u * (2 - u); const y = lerp(80, 1.2, e); return [-3.0 + Math.sin(T * 0.9) * 2.5 * (1 - u), y, -45.5 + Math.cos(T * 0.7) * 2 * (1 - u), 1.4 + Math.sin(T * 1.2) * 0.4, T * 0.8, Math.sin(T * 0.7) * 0.6]; })());
  shot(505, 515, 'ny', C({ p: [[-3.4, 0.7, -42.2], [-3.4, 0.8, -42.4]], l: (u, k) => { const T = k.T; const e = clamp((T - 505.6) / 6.2); return [-3.0, lerp(60, 1.1, e * (2 - e)), -45.5]; }, fov: [38, 34], hand: 0.5, shake: 0.0 }), {
    fadeOut: 1.8, act: (k) => { const T = k.T, w = k.w; w.put('starlight', -3.2, 0, -45.2, 0.0, P.blend(P.kneel(T), { ry: -0.5, sx: 0.1, hx: -0.5, lax: 1.3, rax: 1.3, laz: 0.1, raz: 0.1, le: 0.5, re: 0.5 }, clamp((T - 509.5) / 2.5))); w.actors.starlight.face(-0.9); } });
  loc(506, 510.5, 'Homelander — killed in action');
  say('S', 511.8, 2.6, 'He never knelt.');
  cue(505.4, 'melody', { notes: [[0, 62, 3], [1.8, 65, 3], [3.6, 69, 3.4], [6, 67, 2.2], [8, 62, 4]], g: 0.15, type: 'triangle' });
}
