import { C, orbit } from './cam.js';
import { P } from './models.js';
import { lerp, smooth, clamp, hash } from './util.js';

export function ch2(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, title, sp, flash, pb } = x;
  const NY = W.ny;

  chapter(142, 146.4, 'HOUR 02', 'The Storm · 19:41 EST');
  cue(142, 'tick');
  loc(148, 153, 'Manhattan — 19:41 EST');

  /* ---- skyline, the portals open ---- */
  shot(142, 156, 'ny', C({ p: [[-40, 150, 520], [30, 175, 470]], l: [[-10, 250, -420], [0, 300, -420]], fov: [62, 56], hand: 0.2 }), { holdBlack: 3.4, fadeIn: 2 });
  cue(146, 'portal', { dur: 16, g: 0.35 }); cue(149.5, 'thunder', { dur: 3.2 }); cue(151.5, 'horn', { dur: 6, g: 0.6 }); cue(147, 'riser', { dur: 9, g: 0.1 });

  /* ---- pods rain on Manhattan ---- */
  NY.podData.forEach((p) => { cue(p.t - 1.8, 'whoosh', { dur: 1.8, g: 0.22 }, 'ny'); cue(p.t, 'explosion', { s: 0.9 }, 'ny'); });
  shot(156, 166, 'ny', C({ p: [[0, 1.7, 34], [-1, 1.8, 28]], l: [[8, 280, -120], [-4, 300, -70]], fov: [74, 68], hand: 0.5, shake: 0.02 }));
  cue(157, 'crowd', { n: 8, g: 0.08 }, 'ny'); cue(160, 'horn', { dur: 4, f: 47, g: 0.35 });

  /* ---- panic; the first headcrab ---- */
  shot(166, 176, 'ny', C({ p: [[0, 1.6, -44], [0, 1.65, 8]], l: [[0, 1.3, -110], [0, 1.3, -60]], fov: [52, 50], hand: 0.8 }), {
    act: (k) => {
      const t0 = 174.1, dur = 0.55, u = clamp((k.T - t0) / dur);
      const j = k.w.jumper; j.visible = u > 0 && u < 1.0;
      if (j.visible) { const cp = k.cam.position; j.position.set(lerp(2.6, cp.x, u), 0.4 + Math.sin(u * Math.PI) * 1.6 + u * 1.2, lerp(cp.z - 9, cp.z - 0.35, u)); j.scale.setScalar(1.2 + u * 0.8); j.lookAt(cp); j.rotation.z += 0.0; }
    } });
  cue(168, 'crowd', { n: 10, g: 0.09 }, 'ny'); cue(170, 'crabs', { n: 10, dt: 0.5, g: 0.12 }, 'ny'); cue(174.1, 'screech', { g: 0.5 }, 'ny'); cue(174.5, 'hit', { g: 0.6 });

  /* ---- The Deep ---- */
  const dPos = [0, 0, -14];
  shot(176, 186, 'ny', C({ p: [[5.0, 1.75, -1.5], [3.8, 1.65, -4.5]], l: [[0, 1.55, -14], [0.4, 1.2, -14]], fov: [36, 34], hand: 0.5 }), {
    act: (k) => {
      const lt = k.lt, w = k.w, T = k.T;
      const z = lerp(-34, -14, smooth(lt / 4.2));
      if (lt < 4.5) {
        w.put('deep', dPos[0], 0, lt < 4.2 ? z : dPos[2], 0, lt < 3.7 ? (lt < 4.2 ? P.blend(P.walk(lt * 5.4, 0.6), sp('D', T) ? P.gesture(T, 1) : P.stand(T), lt < 2.6 ? 0.0 : clamp((lt - 2.6) / 1.2)) : P.stand(T)) : P.hurt(clamp((lt - 3.7) / 0.8)));
        if (lt > 3.6) { const j = w.jumper; const u = clamp((lt - 3.6) / 0.5); j.visible = u < 1; j.position.set(lerp(-2.2, 0, u), lerp(0.7, 1.9, u) + Math.sin(u * Math.PI) * 0.9, lerp(-19, -13.85, u)); j.scale.setScalar(1.2); j.lookAt(0, 1.9, -14); }
      } else {
        const a = lt - 4.5;
        const pose = a < 3.2 ? P.blend(P.hurt(1), { rx: 0.3, sx: 0.5, hx: 0.6, lax: 1.8, rax: 1.6, laz: -0.2, raz: 0.3 }, 0.5 + 0.5 * Math.sin(a * 17)) : P.die(clamp((a - 3.2) / 1.6));
        const zz = w.putZ ? null : null;
        w.put('zdeep', dPos[0], 0, dPos[2], 0 + Math.sin(a * 6) * 0.1, pose);
      }
    } });
  say('D', 176.8, 3.6, 'Stay calm, folks! The Seven are on— hey. What’s that thing?');
  cue(180.2, 'screech', { g: 0.4 }, 'ny'); cue(181.0, 'scream', { g: 0.2 }, 'ny'); cue(183.2, 'moan', { dur: 1.8, g: 0.14, f: 100 }, 'ny');

  /* ---- Starlight & Maeve ---- */
  const sC = [0, 0, -20];
  const crabT = [187.4, 188.6, 190.0, 191.2, 192.6, 193.6];
  const crabAt = (i, T) => { // returns [x,y,z,vis,scale]
    const side = i % 2 ? 1 : -1, t = crabT[i], u = (T - (t - 1.1)) / 1.1;
    const sx = side * 10, sz = (i - 2.5) * 1.4, ex = side * 1.35;
    if (u < 0) return [0, 0, 0, false, 1];
    if (u < 1) { const hop = Math.abs(Math.sin(u * 7)); return [sC[0] + lerp(sx, ex, u), 0.1 + hop * 0.5 + (u > 0.85 ? 0.7 * (u - 0.85) * 6 : 0), sC[2] + lerp(sz, 0, u), true, 1.25]; }
    const a = T - t; if (a > 0.7) return [0, 0, 0, false, 1];
    return [sC[0] + side * (1.35 + a * 7), 1.1 + a * 4 - a * a * 6, sC[2] + a * (i % 3 - 1) * 3, true, 1.25 * (1 - a / 0.7)];
  };
  crabT.forEach((t, i) => { const side = i % 2 ? 1 : -1; if (i % 2) cue(t - 0.12, 'punch', { g: 0.45 }, 'ny'); else { cue(t - 0.05, 'zap', { dur: 0.35, g: 0.3 }, 'ny'); NY.beams.add({ a: [sC[0] - 1.0, 1.4, sC[2] - 0.25], b: [sC[0] - 1.35, 1.0, sC[2]], t0: t - 0.05, dur: 0.22, w: 0.1, color: 0xfff4b0 }); NY.flashL.add(sC[0] - 1.0, 1.5, sC[2], t - 0.05, 0.3, 700, 0xfff0a0); } cue(t, 'screech', { g: 0.2 }, 'ny'); });
  shot(186, 196, 'ny', C({ p: orbit(sC, 4.6, 0.2, 2.2, 1.35, 1.8), l: [sC[0], 1.2, sC[2]], fov: 38, hand: 0.4 }), {
    act: (k) => {
      const T = k.T, w = k.w;
      let sw = 0, mw = 0;
      crabT.forEach((t, i) => { const near = clamp(1 - Math.abs(T - (t - 0.2)) / 0.5); if (i % 2) mw = Math.max(mw, near); else sw = Math.max(sw, near); });
      w.put('starlight', sC[0] - 0.5, 0, sC[2], -Math.PI / 2, P.blend(P.idle(T), P.aim(T), sw), {});
      w.put('maeve', sC[0] + 0.5, 0, sC[2], Math.PI / 2, P.blend(P.idle(T), P.punch(0.5), mw), {});
      w.actors.starlight.face(0.0);
      crabT.forEach((t, i) => { const c = w.fcrabs[i]; const r = crabAt(i, T); c.visible = r[3]; if (r[3]) { c.position.set(r[0], r[1], r[2]); c.scale.setScalar(r[4]); c.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2; } });
    } });
  say('S', 188.2, 3.3, 'There’s too many — they’re coming from everywhere!'); say('M', 191.8, 3.2, 'Back to back. Don’t stop moving.');

  /* ---- the Strider drops ---- */
  pb[0].hold(198, 209.5, 0, -330, 0);
  NY.sDrop[0] = { t0: 198, t1: 208.2, h: 520 };
  NY.fx.dustBurst(0, 1, -330, 208.2, 4, 30); NY.fx.dustBurst(0, 1, -330, 208.4, 2.5, 20); NY.flashL.add(0, 4, -326, 208.2, 0.9, 5000, 0x9fe0ff);
  shot(196, 206, 'ny', C({ p: [[4, 2, -100], [4, 3, -110]], l: (u, k) => [0, 17 + (1 - smooth(clamp((k.T - 198) / 10.2))) * 520, -330], fov: [44, 40], hand: 0.3 }));
  cue(196.5, 'horn', { dur: 5, f: 44, g: 0.6 }); cue(198, 'riser', { dur: 10, g: 0.14 }); cue(199, 'dropship', { dur: 8, g: 0.25 }, 'ny'); cue(204, 'thunder', { dur: 3 });
  cue(208.2, 'stomp', { g: 1.2 }); cue(208.2, 'hit', { g: 1.0 });

  /* ---- Strider close pass ---- */
  pb[0].seg(209.5, 0, -330, 240, 0, -120);
  const stridePath = (t0, t1, z0, z1, g = 0.7) => { const n = Math.floor((t1 - t0) / 0.58); for (let i = 0; i < n; i++) cue(t0 + i * 0.58, 'stomp', { g: g * (0.85 + 0.15 * (i % 2)) }, 'ny'); };
  shot(206, 215, 'ny', C({ p: [[-12, 1.5, -302], [-12, 1.7, -296]], l: [[0, 11, -330], [0, 12, -292]], fov: [56, 64], hand: 0.5, shake: 0.06, shakeEnv: (lt) => clamp((lt - 2) / 3) }));
  stridePath(209.8, 215, 0, 0, 1.0);
  cue(209.5, 'horn', { dur: 3.5, f: 50, g: 0.45 });

  /* ---- it fires on the avenue — a tower falls ---- */
  NY.striderFire(0, 219.2, [40, 62, -120], { s: 3.4 });
  NY.fx.dustBurst(40, 100, -120, 220.2, 6, 20); NY.fx.dustBurst(40, 50, -120, 221.2, 6, 20); NY.fx.dustBurst(40, 6, -120, 223.0, 8, 30); NY.fx.dustBurst(40, 6, -120, 224.2, 6, 24);
  NY.boom(220.4, 38, 120, -118, 2.4); NY.boom(221.8, 44, 60, -125, 2.8); NY.boom(223.2, 36, 8, -118, 3.2);
  NY.burn(40, 3, -120, 224, 600, 2.4); NY.burn(10, 1, -150, 222, 600, 1.2);
  cue(221, 'glass', {}, 'ny'); cue(222, 'glass', {}, 'ny'); cue(221.2, 'thunder', { dur: 3.5, g: 0.8 });
  NY.gunTrack[0].push([[210, -70, 150, -540], [220, -30, 120, -320], [230, 10, 100, -130], [238, 50, 130, 40]]);
  NY.gunTrack[1].push([[212, 80, 170, -560], [222, 40, 135, -330], [232, -20, 110, -150], [240, -60, 140, 50]]);
  NY.gunFire(0, 225, 227.4, [-6, 0, -100], 26);
  NY.boom(225.8, -6, 1, -100, 1.1); NY.boom(226.6, 4, 1, -96, 1.0);
  shot(215, 224, 'ny', C({ p: [[-22, 3, -62], [-20, 3.4, -66]], l: [[40, 56, -120], [40, 34, -120]], fov: [50, 52], hand: 0.5, shake: 0.05, shakeEnv: (lt) => (lt > 4 ? 1 : 0.2) }));
  cue(215, 'steps', { n: 9, dt: 0.58, g: 0.55 }, 'ny'); cue(215.5, 'siren', { dur: 8, g: 0.05 }, 'ny');

  /* ---- Homelander meets the Strider ---- */
  const hl = [0, 0, -130];
  NY.beams.add({ a: [0.12, 1.78, -130.2], b: [0, 17, -206], t0: 229.6, dur: 0.9, w: 0.12, color: 0xff3a2a, opacity: 1 });
  NY.beams.add({ a: [-0.12, 1.78, -130.2], b: [0, 17, -206], t0: 229.6, dur: 0.9, w: 0.12, color: 0xff3a2a, opacity: 1 });
  NY.fx.explosion(0, 17, -206, 229.7, 0.6); NY.film.cue(229.6, 'laser', { dur: 0.9, g: 0.25 }, 'ny');
  NY.striderFire(0, 231.0, [0, 1.8, -131], { s: 3.0, noBoom: false });
  pb[0].seg(240, 0, -120, 252, 0, -118, 0);
  shot(224, 232, 'ny', C({ p: [[-4.2, 1.7, -114], [-3.2, 1.75, -116]], l: [[1.2, 7, -168], [1.0, 6, -160]], fov: [44, 40], hand: 0.4 }), {
    act: (k) => {
      const lt = k.lt, T = k.T, w = k.w;
      const land = smooth(clamp(lt / 1.6)); const y = (1 - land) * (1 - land) * 30;
      w.put('homelander', hl[0], y, hl[2] + (1 - land) * 6, Math.PI, y > 0.3 ? P.fly(T, land) : P.hero(T), { flow: y > 0.3 ? 0.7 : 0.18, heat: T > 229.6 && T < 230.6 });
      w.actors.homelander.face(0.9);
    } });
  say('H', 226.4, 3.0, 'That’s it? A tripod?'); say('H', 229.0, 1.2, 'Let’s see you—');
  cue(224.4, 'whoosh', { dur: 1.6, g: 0.4 }, 'ny'); cue(227, 'steps', { n: 4, dt: 0.6, g: 0.5 }, 'ny'); cue(230.9, 'hit', { g: 1 }); flash(231.1, 0.5);
}
