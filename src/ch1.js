import { C } from './cam.js';
import { P } from './models.js';
import { PathB } from './common.js';
import { lerp, smooth, clamp } from './util.js';

export const THEME = [[0, 62, 1.6], [1.4, 65, 1.4], [2.8, 69, 2.2], [5.2, 67, 1.2], [6.4, 65, 1.2], [7.6, 64, 1.2], [8.8, 62, 3.4]];

export function ch1(x) {
  const { W, film, shot, say, cue, chapter, loc, lower, title, sp, flash } = x;
  const V = W.vegas, B = W.board, H = W.hide, NY = W.ny;

  /* ================= PROLOGUE — LAS VEGAS ================= */
  loc(2, 8.5, 'Las Vegas, Nevada — 15:12 PST');
  shot(0, 9, 'vegas', C({ p: [[-30, 2.6, 330], [-22, 3.0, 300]], l: [[-60, 60, -300], [10, 330, -420]], fov: [50, 62], hand: 0.3 }), { fadeIn: 3.2, holdBlack: 0.4 });
  cue(0, 'portal', { dur: 12, g: 0.35 }); cue(3.4, 'thunder', { dur: 3.5 }); cue(5.2, 'horn', { dur: 5.5, g: 0.55 }); cue(0.2, 'riser', { dur: 8.5, g: 0.1 });

  shot(9, 17, 'vegas', C({ p: [[10, 3.2, 400], [6, 3.4, 380]], l: [[20, 170, -420], [20, 190, -420]], fov: [66, 60], roll: [0, 0.02], hand: 0.3 }));
  cue(10, 'crowd', { n: 6, g: 0.07 }, 'vegas'); cue(12.6, 'thunder', { dur: 3 }); cue(14.5, 'stab', { m: 38, dur: 3.2, g: 0.15 });

  shot(17, 26, 'vegas', C({ p: [[0, 1.7, 14], [1, 1.8, 8]], l: [[8, 230, -110], [16, 330, -170]], fov: [70, 62], hand: 0.5, shake: 0.03, shakeEnv: (lt) => (lt > 4 ? 1 : 0.2) }));
  cue(17, 'riser', { dur: 9, g: 0.12 });
  V.podData.forEach((p) => { cue(p.t, 'explosion', { s: 0.8 }, 'vegas'); cue(p.t - 1.8, 'whoosh', { dur: 1.8, g: 0.2 }, 'vegas'); });

  shot(26, 35, 'vegas', C({ p: [[-4, 2.2, 46], [4, 2.6, 34]], l: [[0, 14, -110], [6, 16, -150]], fov: [48, 44], hand: 0.5, shake: 0.05, shakeEnv: (lt) => (lt < 3.5 ? 1 : 0.3) }));
  cue(26.4, 'horn', { dur: 4, f: 46, g: 0.5 }); cue(27.2, 'crabs', { n: 8, g: 0.1 }, 'vegas'); cue(30, 'crowd', { n: 8, g: 0.08 }, 'vegas');
  cue(28, 'steps', { n: 7, dt: 0.62, g: 0.5 }, 'vegas');

  shot(35, 41, 'vegas', C({ p: [[-16, 1.5, -92], [-13, 1.9, -102]], l: [[6, 13, -112], [3, 15, -124]], fov: [58, 50], hand: 0.6, shake: 0.05 }));
  cue(35, 'steps', { n: 9, dt: 0.62, g: 0.8 }, 'vegas'); cue(37.4, 'horn', { dur: 3.4, f: 49, g: 0.4 }); cue(39.4, 'riser', { dur: 2.2, g: 0.15 });

  // title over black
  shot(41, 46, 'vegas', C({ p: [0, 200, 200], l: [0, 300, -420], fov: 40 }), { holdBlack: 5 });
  title(41.4, 45.8, 'SEVEN HOURS', 'The Seven  vs.  The Combine');
  cue(41.0, 'hit', { g: 1 }); cue(41.6, 'melody', { notes: THEME, g: 0.16, type: 'triangle' });

  /* ================= HOUR 01 ================= */
  chapter(46, 50.4, 'HOUR 01', 'New York City · 18:20 EST');
  cue(46, 'tick'); cue(46.2, 'stab', { m: 38, dur: 3, g: 0.1 });
  loc(52, 57, 'Vought Tower, Manhattan');
  shot(46, 58, 'ny', C({ p: [[-4, 3, -10], [-6, 80, -4], [-8, 188, -16]], l: [[-70, 60, -50], [-60, 140, -50], [-33, 190.8, -50]], fov: [56, 44], hand: 0.2 }), { holdBlack: 2.6, fadeIn: 2.0 });
  cue(49.5, 'siren', { dur: 10, g: 0.04 }, 'ny');

  // Homelander on the helipad — rear
  const hPos = [-29, 189.6, -50];
  lower(60, 65, 'HOMELANDER', 'The Seven · America’s Greatest Hero', '#ff6666');
  shot(58, 67, 'ny', C({ p: [[-34.4, 191.0, -51.6], [-33.4, 190.8, -51.2]], l: [[-20, 191.4, -49], [8, 196, -55]], fov: [34, 32], hand: 0.4 }), {
    act: (k) => k.w.put('homelander', hPos[0], hPos[1], hPos[2], Math.PI / 2, P.hero(k.T), { flow: 0.28, wind: 1.2 }) });
  say('H', 60.2, 4.6, 'Ten thousand gone in nine minutes. Not one of them got to say my name.');

  // face
  shot(67, 75, 'ny', C({ p: [[-23.2, 190.9, -47.3], [-24.4, 190.85, -48.0]], l: [[-29, 191.15, -50], [-29, 191.2, -50]], fov: [26, 22], hand: 0.3 }), {
    act: (k) => { const a = k.w.put('homelander', hPos[0], hPos[1], hPos[2], Math.PI / 2 + 0.55, P.hero(k.T), { flow: 0.25, smile: 0.9 }); a.head.rotation.y = 0.0; } });
  say('H', 68.2, 3.2, 'They’ll say it tonight.');
  cue(72, 'radio', {}, 'ny'); say('ASH', 72.4, 2.8, 'Homelander. Mr. Edgar needs the Seven in the boardroom. Now.', { radio: true });

  // lift off
  shot(75, 81, 'ny', C({ p: [[-21, 189.9, -41], [-20, 195, -38]], l: [[-29, 193, -50], [-20, 215, -50]], fov: [38, 52], hand: 0.5 }), {
    act: (k) => { const lt = k.lt; const fl = smooth((lt - 2.2) / 1.2); const y = hPos[1] + fl * fl * 40 + Math.max(0, lt - 3.4) * 24; const x = hPos[0] + Math.max(0, lt - 3.4) * 30;
      k.w.put('homelander', x, y, hPos[2], Math.PI / 2, lt < 2.2 ? P.hero(k.T) : P.blend(P.hero(k.T), P.fly(k.T, 0.0), clamp((lt - 2.4) / 1.5)), { flow: 0.3 + fl * 0.7 }); } });
  say('H', 75.4, 3.6, 'Of course, Ashley. I’d hate to be late for my own apocalypse.');
  cue(77.4, 'whoosh', { dur: 1.5, g: 0.35 }, 'ny'); cue(78.4, 'burner', { dur: 3, g: 0.12 }, 'ny');

  /* ---------- Boardroom ---------- */
  const seat = (name, x, z, ry, T, talk = false) => B.put(name, x, 0, z, ry, P.sit(T, talk ? 1 : 0.25));
  const act0 = (k, o = {}) => {
    const T = k.T, w = k.w;
    w.put('edgar', 5.3, 0, 0, -Math.PI / 2, sp('E', T) ? P.gesture(T, 0.6) : P.stand(T));
    w.put('ashley', 4.9, 0, 2.5, -2.25, sp('ASH', T) ? P.gesture(T, 0.5) : P.stand(T));
    seat('maeve', -1.2, 1.97, Math.PI, T, sp('M', T)); seat('starlight', 1.4, 1.97, Math.PI, T, sp('S', T));
    seat('atrain', -3.6, -1.97, 0, T, sp('A', T)); seat('deep', 1.4, -1.97, 0, T, sp('D', T));
    w.put('noir', 9.4, 0, 4.8, -2.4, P.stand(T));
    if (!o.noHome) w.put('homelander', 0.2, 0, -5.7, Math.PI, P.hero(T), { flow: 0 });
    if (o.sb) o.sb(k);
  };
  shot(81, 89.5, 'board', C({ p: [[11.0, 2.1, 5.6], [7.6, 1.75, 4.5]], l: [[-2, 1.3, -0.5], [-1, 1.25, -0.2]], fov: [48, 42], hand: 0.3 }), { act: (k) => act0(k, { noHome: true }) });
  lower(81.5, 83.3, 'QUEEN MAEVE', 'The Seven', '#d6b3ff'); lower(83.3, 85.1, 'STARLIGHT', 'The Seven', '#fff2a8'); lower(85.1, 86.9, 'A-TRAIN', 'The Seven — World’s Fastest Man', '#7ab8ff');
  lower(86.9, 88.7, 'THE DEEP', 'The Seven', '#6fe3d8'); lower(88.7, 90.5, 'BLACK NOIR', 'The Seven', '#cfcfcf');
  say('ASH', 83.4, 2.9, 'Everyone’s here. Except Homelander. Naturally.'); say('E', 86.6, 2.9, 'He’ll come. He wants an audience.');
  cue(81, 'static', { dur: 0.3, g: 0.05 }, 'board');

  shot(89.5, 99, 'board', C({ p: [[2.8, 1.55, 3.4], [1.6, 1.6, 2.3]], l: [[0, 1.65, -6.5], [0, 1.7, -6.5]], fov: [40, 36], hand: 0.3 }), { act: (k) => act0(k) });
  say('H', 90.6, 3.0, 'Sorry I’m late. Traffic.'); say('E', 94.0, 5.0, 'Las Vegas stopped transmitting at 3:12 Pacific. We have satellite images of… whatever those are.');

  shot(99, 106, 'board', C({ p: [[-3.2, 1.5, -4.4], [-1.6, 1.45, -4.2]], l: [[0.5, 1.2, 2.2], [0.8, 1.2, 2.0]], fov: [36, 32], hand: 0.3 }), { act: (k) => act0(k) });
  say('S', 99.3, 3.4, 'People are dying out there. Why are we still sitting here?'); say('E', 103.0, 3.0, 'Because the same signature is forming over Manhattan. Forty minutes. Maybe less.');
  cue(104.2, 'thunder', { dur: 2.5, g: 0.5 }, 'board');

  shot(106, 114, 'board', C({ p: [[-2.5, 1.45, 4.6], [-0.5, 1.5, 4.4]], l: [[1, 1.25, -2.0], [1.6, 1.25, -2.0]], fov: [38, 34], hand: 0.3 }), {
    act: (k) => act0(k, { sb: (kk) => { const lt = kk.lt; const x = lerp(-9.5, 3.4, smooth(lt / 5.5)); kk.w.put('soldierboy', x, 0, 5.0 - 0.12 * Math.sin(lt), lt < 5.5 ? Math.PI * 0.62 : Math.PI, lt < 5.5 ? P.walk(lt * 5.2, 0.7) : P.arms_crossed(kk.T)); } }) });
  lower(107.4, 110.4, 'SOLDIER BOY', 'Ex-Payback · Back In The Game', '#ffa04a');
  say('D', 106.4, 3.2, 'Quick question. Any chance they’re, uh… water-based?'); say('A', 109.7, 2.2, 'Pretty sure they’re not, Kevin.');
  say('SB', 112.0, 2.6, 'Aliens? I fought Nazis. Point me at one.');

  shot(114, 116.6, 'board', C({ p: [[-2.2, 1.6, 3.8], [-3.6, 1.6, 3.2]], l: [[-11, 2.4, -0.4], [-11, 2.4, -0.4]], fov: [46, 40], hand: 0.2 }), { act: (k) => act0(k, { noHome: false }) });
  shot(116.6, 119.5, 'board', C({ p: [[-1.6, 1.38, -1.1], [-1.4, 1.36, -0.5]], l: [[-1.2, 1.3, 1.97], [-1.2, 1.3, 1.97]], fov: [30, 26], hand: 0.3 }), { act: (k) => { act0(k, { noHome: false }); k.w.actors.maeve.face(-0.3); } });
  say('M', 116.9, 2.4, 'Then let\u2019s make it count.');
  cue(114, 'heartbeat', { n: 5 }, 'board');

  /* ---------- Boys' hideout ---------- */
  const hide = (k, o = {}) => {
    const T = k.T, w = k.w;
    w.put('butcher', 0.4, 0, -0.1, Math.PI, P.blend(P.idle(T), { sx: 0.32, lax: 0.9, rax: 0.9, le: 0.9, re: 0.9, laz: -0.1, raz: -0.1 }, 1));
    w.put('hughie', -1.6, 0, 0.5, Math.PI + 0.2, sp('HU', T) ? P.gesture(T, 0.5) : P.idle(T));
    w.put('mm', 2.4, 0, 0.3, Math.PI - 0.3, sp('MM', T) ? P.gesture(T, 0.7) : P.arms_crossed(T));
    w.put('frenchie', -3.3, 0, 0.9, Math.PI * 0.8, sp('F', T) ? P.gesture(T, 0.9) : P.sit(T, 0.3));
    w.put('kimiko', 3.9, 0, -1.3, Math.PI + 0.5, sp('K', T) ? P.gesture(T, 1.0) : P.idle(T));
  };
  shot(119.5, 127, 'hide', C({ p: [[0.5, 1.5, 4.8], [0.4, 1.5, 3.4]], l: [[0, 1.3, -1.2], [0.2, 1.4, -0.4]], fov: [42, 36], hand: 0.3 }), { act: hide, fadeIn: 1.6, holdBlack: 0.4 });
  lower(120, 122, 'BILLY BUTCHER', 'The Boys', '#e8e8e8'); lower(122, 124, 'HUGHIE CAMPBELL', 'The Boys', '#a8d0ff');
  say('HU', 120.6, 3.6, 'Billy… those things walked through a casino like it was a sandbox.'); say('BU', 124.4, 3.0, 'Aye. And in an hour Homelander’s gonna try to punch one on live telly.');
  cue(119.5, 'static', { dur: 0.4, g: 0.05 }, 'hide');

  shot(127, 135, 'hide', C({ p: [[4.8, 1.5, 3.6], [1.2, 1.5, 3.6]], l: [[2.4, 1.3, 0.1], [-2.4, 1.2, 0.5]], fov: [38, 40], hand: 0.3 }), { act: hide });
  lower(127.4, 129.4, 'MOTHER’S MILK', 'The Boys', '#c9ff9a'); lower(129.4, 131.4, 'FRENCHIE', 'The Boys', '#ffb0d0');
  say('MM', 127.6, 3.0, 'Let him. Maybe they’ll take each other out.'); say('F', 131.0, 3.4, 'Mon ami, zey will not take each other out. Zey will take us out.');

  shot(135, 142, 'hide', C({ p: [[5.4, 1.4, 1.8], [4.6, 1.45, 1.4]], l: [[3.9, 1.3, -1.3], [3.9, 1.35, -1.3]], fov: [32, 26], hand: 0.3 }), { act: hide, fadeOut: 1.2 });
  lower(135.2, 137.2, 'KIMIKO', 'The Boys', '#ffffff');
  say('K', 135.6, 2.4, '[signs] We help. Now.', { silent: true }); say('BU', 138.3, 3.6, 'Right. Gear up. We still don’t trust the bastard — we’ve just got a bigger one to hate.');
}
