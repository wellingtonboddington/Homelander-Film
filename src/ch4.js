import { C, orbit } from './cam.js';
import { P } from './models.js';
import { lerp, smooth, clamp, hash } from './util.js';
import { glowSprite } from './fx.js';
import * as THREE from 'three';

export function ch4(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, flash, pb } = x;
  const SIT = W.sit, CORR = W.corr;
  chapter(300, 304.4, 'HOUR 04', 'The Table · 23:10 EST');
  cue(300, 'tick');
  loc(305, 310, 'Situation Room — Washington, D.C.');

  // Homelander: scorched
  const hh = SIT.actors.homelander; hh.mats.suit.color.multiplyScalar(0.62); hh.capeMesh.material.color.multiplyScalar(0.5);
  const soot = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite(0x000000, 1, 1).material.map, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false }));
  soot.scale.set(0.55, 0.5, 1); soot.position.set(0.08, 0.38, 0.17); hh.spine.add(soot);
  const soot2 = soot.clone(); soot2.scale.set(0.3, 0.3, 1); soot2.position.set(-0.2, 0.5, 0.14); hh.spine.add(soot2);

  const ring = (name, ang, r, pose, o) => SIT.put(name, Math.cos(ang) * r, 0, Math.sin(ang) * r, Math.atan2(-Math.cos(ang), -Math.sin(ang)), pose, o);
  const room = (k, o = {}) => {
    const T = k.T, w = k.w, g = (key, amt = 0.8) => (x.sp(key, T) ? P.gesture(T, amt) : P.stand(T));
    ring('general', -1.45, 4.2, x.sp('G', T) ? P.blend(P.gesture(T, 1.0), P.point(T), 0.4) : P.stand(T));
    ring('neuman', -0.45, 4.3, g('N', 0.8));
    ring('edgar', -2.55, 4.2, g('E', 0.5));
    ring('ashley', -2.95, 4.5, P.stand(T));
    ring('staff0', 0.55, 4.6, P.idle(T)); ring('staff1', 2.3, 4.7, P.idle(T)); ring('staff2', 2.9, 4.6, P.idle(T)); ring('staff3', -3.4, 4.6, P.idle(T));
    ring('soldierboy', 0.1, 6.8, P.arms_crossed(T));
    if (o.home) o.home(k);
  };
  const homeAt = (px, pz, ry, T, flow = 0) => SIT.put('homelander', px, 0, pz, ry, P.blend(P.hero(T), { ry: 0, sx: 0.06, hx: 0.25, lax: 0.1, rax: 0.1, laz: 0.1, raz: 0.1, le: 0.1, re: 0.1 }, 0.55), { flow });

  /* ---- establishing ---- */
  shot(300, 309, 'sit', C({ p: orbit([0, 0, 0], 7.4, 0.5, 1.15, 3.0, 2.2), l: [0, 1.4, -1.5], fov: [44, 42], hand: 0.2 }), { act: room, holdBlack: 3.9, fadeIn: 1.4 });
  cue(300, 'siren', { dur: 14, g: 0.04 }, 'sit');
  say('G', 304.0, 3.6, 'We’ve lost the Northeast corridor. First Armored is gone.');

  /* ---- the broadcast ---- */
  SIT.alarmOn = 1;
  shot(309, 318, 'sit', C({ p: [[0.5, 1.5, 4.2], [0.2, 1.7, -0.8]], l: [[0, 2.8, -10], [0, 2.9, -10]], fov: [50, 40], hand: 0.3 }), { act: (k) => { SIT.screenMode = k.T > 311 ? 1 : 0; room(k); } });
  say('G', 307.4, 3.2, 'They’re not killing everyone. That’s what scares me.');
  cue(311, 'horn', { dur: 5, f: 48, g: 0.55 }, 'sit'); cue(311, 'static', { dur: 0.6, g: 0.12 }, 'sit');
  say('ADV', 311.2, 3.4, 'Citizens of Earth. You are subjects of the Universal Union. Cease resistance.');
  say('ADV', 315.9, 3.0, 'Surrender your leaders. Resistance will be corrected.');

  shot(318, 326, 'sit', C({ p: [[-5.5, 1.6, 3.5], [-3.5, 1.65, 3.2]], l: [[0.5, 1.6, -3], [1.4, 1.6, -3]], fov: [38, 34], hand: 0.3 }), { act: (k) => { SIT.screenMode = 1; room(k); } });
  say('G', 320.4, 3.4, 'The President authorized tactical weapons. Three warheads. Manhattan.');
  say('N', 324.2, 1.6, 'On our own city?!');
  cue(318, 'heartbeat', { n: 8 }, 'sit');

  shot(326, 334, 'sit', C({ p: [[5.8, 1.5, -1.0], [4.2, 1.55, 0.0]], l: [[-2.5, 1.55, -3.6], [-2.8, 1.55, -3.4]], fov: [34, 32], hand: 0.3 }), { act: (k) => { SIT.screenMode = 0; room(k); } });
  say('G', 326.5, 3.0, 'Two million are dying anyway, Congresswoman.');
  say('E', 330.2, 4.2, 'Before anyone ends New York… let Vought do some talking.');

  /* ---- Homelander enters ---- */
  shot(334, 342, 'sit', C({ p: [[0.5, 1.45, -4.2], [0.2, 1.5, -3.6]], l: [[0, 1.6, 8], [0, 1.6, 6]], fov: [38, 34], hand: 0.3 }), {
    act: (k) => { room(k, { home: (kk) => { const lt = kk.lt; const z = lerp(10.5, 5.4, smooth(lt / 4.2)); if (lt < 4.4) SIT.put('homelander', 0, 0, z, Math.PI, P.blend(P.walk(lt * 4.4, 0.7), P.hero(kk.T), 0.3), { flow: 0.15 }); else homeAt(0, z, Math.PI, kk.T); } }); } });
  say('H', 335.6, 1.4, 'It hurt.'); say('H', 338.0, 3.2, 'Nothing hurts me. And that thing hurt me.');
  cue(334, 'door', {}, 'sit');

  shot(342, 350, 'sit', C({ p: [[-1.7, 1.66, 2.5], [-0.9, 1.68, 3.1]], l: [[0.2, 1.7, 5.4], [0.2, 1.72, 5.4]], fov: [30, 24], hand: 0.3 }), {
    fadeOut: 1.2, act: (k) => { room(k, { home: (kk) => homeAt(0.2, 5.4, Math.PI * 0.95, kk.T) }); const e = SIT.actors.homelander; e.face(-0.3); e.heat(k.T > 347.5 && k.T < 349.5); } });
  say('E', 342.6, 3.4, 'They’ve offered terms. A ceasefire. A seat at the table.');
  say('H', 346.6, 2.4, 'I’ll go and kill them.');
  cue(347.6, 'laser', { dur: 2, g: 0.15 }, 'sit'); cue(349, 'whoosh', { dur: 1.2, g: 0.4 }, 'sit');

  /* ================== HOUR 05 — BELOW ================== */
  chapter(350, 354.4, 'HOUR 05', 'Below · 00:40 EST');
  cue(350, 'tick');
  loc(355, 360, 'Vought Tower — Sublevel 9');
  const bg = (name, x0, z0, ry, pose) => CORR.put(name, x0, 0, z0, ry, pose);
  const walkers = (k, z0, dir = -1, spd = 1.6) => {
    const T = k.T, lt = k.lt; const z = z0 + dir * lt * spd; const ph = lt * 5.2;
    bg('butcher', 0.0, z, dir < 0 ? Math.PI : 0, P.walk(ph, 0.8)); bg('hughie', -0.8, z + 1.7 * -dir * -1, dir < 0 ? Math.PI : 0, P.walk(ph + 1.1, 0.8));
    bg('mm', 0.8, z + 1.8, dir < 0 ? Math.PI : 0, P.walk(ph + 2.0, 0.8)); bg('frenchie', -0.5, z + 3.4, dir < 0 ? Math.PI : 0, P.walk(ph + 3.0, 0.8)); bg('kimiko', 0.5, z + 3.6, dir < 0 ? Math.PI : 0, P.walk(ph + 0.5, 0.9));
    CORR.torch.intensity = 150; CORR.torch.position.set(0.1, 1.5, z - 0.3); CORR.torch.target.position.set(0, 0.8, z - 12);
  };
  CORR.tracers.burst([0, 1.3, -33], [0, 1.0, -12], 361, 367.5, 22, 0.8, 90);
  shot(350, 360, 'corr', C({ p: (u, k) => [0, 1.55, -9 - k.lt * 1.6 - 5.2], l: (u, k) => [0, 1.1, -9 - k.lt * 1.6], fov: 42, hand: 0.5 }), { act: (k) => walkers(k, -9), holdBlack: 4.2, fadeIn: 1.2 });
  say('BU', 354.6, 3.4, 'Shelter Seven’s behind that door. Three hundred civilians.');
  say('HU', 358.0, 2.4, 'Billy… is that scratching?');
  cue(350, 'siren', { dur: 14, g: 0.04 }, 'corr'); cue(357.2, 'crabs', { n: 8, dt: 0.45, g: 0.08 }, 'corr'); cue(350, 'heartbeat', { n: 10 }, 'corr');

  /* ---- ref composition: crabs in the foreground ---- */
  const fireAct = (k, z0) => {
    const T = k.T;
    const sp = (name, px, pz, ry, pose, seed) => { const h = bg(name, px, pz, ry, pose); const on = hash(Math.floor(T * 15) + seed) > 0.35 ? 0.95 : 0; if (h.flash) h.flash.material.opacity = on; return h; };
    sp('butcher', 0.1, z0, 0, P.aim(T), 1); sp('mm', 1.0, z0 - 1.2, 0, P.aim(T), 2); sp('hughie', -1.0, z0 - 1.5, 0, P.crouchAim(T), 3);
    bg('frenchie', 1.1, z0 - 7.6, 0, P.idle(T)); bg('kimiko', -0.6, z0 - 4, 0, P.run(T * 12, 1));
    CORR.torch.intensity = 0;
  };
  shot(360, 368, 'corr', C({ p: [[0, 1.5, -18.5], [0, 1.5, -20.5]], l: [[0, 1.4, -34], [0, 1.4, -36]], fov: [44, 42], hand: 0.5, shake: 0.02 }), {
    act: (k) => { const T = k.T; fireAct(k, -35); CORR.big.forEach((b, i) => { b.visible = true; b.position.set(i ? 2.0 : -2.1, 0.0, -21.5 + Math.sin(T * 3 + i) * 0.1); b.rotation.set(0, Math.PI, 0); b.scale.setScalar(2.6); animHC(b, T); }); } });
  say('BU', 361.2, 2.6, 'Here they come! Fire!');
  cue(360.5, 'autofire', { dur: 7, rate: 16, g: 0.14, f: 1500 }, 'corr'); cue(361, 'crabs', { n: 14, dt: 0.4, g: 0.1 }, 'corr');

  /* ---- Kimiko ---- */
  shot(368, 376, 'corr', C({ p: [[1.2, 1.35, -39], [0.6, 1.3, -41]], l: [[-0.2, 1.1, -45], [-0.1, 1.1, -46]], fov: [40, 34], hand: 0.8, shake: 0.03 }), {
    act: (k) => { const T = k.T; const lt = k.lt;
      bg('kimiko', -0.3, -45.5 + Math.sin(lt * 5) * 0.4, 0, lt % 1.2 < 0.5 ? P.punch((lt % 1.2) / 0.5) : P.run(T * 11, 1)); bg('mm', 1.1, -42.3, 0, P.aim(T)); bg('hughie', -1.0, -40.6, 0, P.aim(T)); bg('butcher', 0.1, -43.5, 0, P.aim(T)); bg('frenchie', 0.4, -53, Math.PI, P.crouchAim(T));
      ['butcher', 'mm', 'hughie'].forEach((n, i) => { const h = CORR.actors[n]; if (h.flash) h.flash.material.opacity = hash(Math.floor(T * 15) + i) > 0.35 ? 0.9 : 0; }); CORR.torch.intensity = 0; } });
  say('F', 369.2, 3.0, 'Zee door is jammed! It is sealed from zee other side!');
  say('BU', 372.4, 2.6, 'Then unseal it, Frenchie!');
  cue(368, 'autofire', { dur: 8, rate: 16, g: 0.12, f: 1500 }, 'corr'); cue(371, 'crabs', { n: 10, dt: 0.35, g: 0.1 }, 'corr'); cue(373.6, 'door', {}, 'corr');

  /* ---- Frenchie ---- */
  const fz = -54;
  shot(376, 382, 'corr', C({ p: [[-1.6, 1.62, fz + 5.2], [-1.2, 1.64, fz + 4.4]], l: [[0.3, 1.55, fz], [0.3, 1.57, fz]], fov: [24, 20], hand: 0.5 }), {
    act: (k) => { const T = k.T; bg('frenchie', 0.4, fz, 0, x.sp('F', T) ? P.gesture(T, 0.8) : P.idle(T)); bg('kimiko', -0.7, fz + 1.2, 0.3, P.idle(T)); bg('mm', 1.2, fz + 1.2, 0.0, P.aim(T)); CORR.actors.frenchie.face(0.35); } });
  say('F', 376.4, 3.2, 'Zee door only closes from zis side. Someone must stay.');
  say('K', 379.6, 2.2, '[signs] No.', { silent: true });
  cue(376, 'melody', { notes: [[0, 62, 2], [1.6, 65, 2], [3.2, 69, 2.4], [5.6, 67, 1.6], [7.2, 65, 1.6], [8.8, 62, 3.6]], g: 0.15, type: 'triangle' });

  shot(382, 388.4, 'corr', C({ p: [[-1.0, 1.62, fz + 4.4], [-0.3, 1.64, fz + 3.6]], l: [[0.4, 1.55, fz], [0.4, 1.57, fz]], fov: [22, 17], hand: 0.4 }), {
    act: (k) => { const T = k.T; bg('frenchie', 0.4, fz, 0, P.idle(T)); CORR.actors.frenchie.face(0.5); bg('kimiko', -0.9, fz + 1.4, 0.5, P.cower(T)); } });
  say('F', 382.4, 3.0, 'Kimiko. Mon amour. Go. Live. Zat is not a request.');
  say('BU', 385.8, 2.2, 'Frenchie— thank you.');
  cue(382, 'heartbeat', { n: 6 }, 'corr');

  shot(388.4, 393, 'corr', C({ p: [[0.5, 1.3, fz + 9], [0.5, 1.4, fz + 7.5]], l: [[0.5, 1.2, fz], [0.5, 1.2, fz]], fov: [34, 30], hand: 0.2, shake: 0.35, shakeEnv: (lt) => Math.exp(-lt * 1.6) }), {
    act: (k) => { const T = k.T; bg('kimiko', 0.4, fz + 5, 0.0, P.cower(T)); bg('mm', -0.6, fz + 6.3, 0, P.cower(T)); CORR.door.position.z = -62; } });
  cue(388.4, 'explosion', { s: 2.4 }, 'corr'); flash(388.4, 0.5); cue(388.6, 'stab', { m: 33, dur: 3, g: 0.14 });
  cue(389, 'moan', { dur: 3, g: 0.08, f: 70 }, 'corr');

  shot(393, 402, 'corr', C({ p: [[1.9, 1.5, fz + 11.5], [1.4, 1.5, fz + 10.5]], l: [[0, 1.0, fz + 3], [0, 0.9, fz + 3]], fov: [40, 36], hand: 0.3 }), {
    act: (k) => { const T = k.T; bg('kimiko', 0.0, fz + 2.2, Math.PI, P.kneel(T)); bg('mm', 0.9, fz + 3.9, Math.PI, P.stand(T)); bg('butcher', -0.9, fz + 3.9, Math.PI * 0.8, P.stand(T)); bg('hughie', 0.2, fz + 5.4, Math.PI, P.stand(T)); } });
  say('BU', 394.0, 3.6, 'He bought us the time. Don’t waste it.');
  say('HU', 398.0, 3.4, 'Billy… the Seven are still up there.');

  shot(402, 410, 'corr', C({ p: [[0.2, 1.5, fz + 9], [0.1, 1.5, fz + 12]], l: [[0, 1.2, fz + 2], [0, 1.2, fz]], fov: 40, hand: 0.3 }), {
    fadeOut: 1.6, act: (k) => { const T = k.T, lt = k.lt; const z = fz + 4 + lt * 1.4; [['butcher', -0.6], ['hughie', 0.6], ['mm', 0.0]].forEach(([n, xx], i) => bg(n, xx, z + i * 1.5, 0, P.walk(lt * 4.5 + i, 0.8))); bg('kimiko', 0.0, z + 5.6, 0, P.walk(lt * 4.2, 0.6)); } });
  say('BU', 402.4, 4.2, 'Then let’s go and see how long a god lasts.');
}
import { animHeadcrab } from './models.js';
const animHC = (b, T) => animHeadcrab(b, T, 'crawl');
