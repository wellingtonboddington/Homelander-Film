import { NYWorld } from './world_ny.js';
import { VegasWorld } from './world_vegas.js';
import { BoardWorld, SitWorld, HideWorld, CorrWorld } from './world_interior.js';
import { AirWorld } from './world_air.js';
import { kf } from './util.js';
import { PathB } from './common.js';
import { ch1 } from './ch1.js';
import { ch2 } from './ch2.js';
import { ch3 } from './ch3.js';
import { ch4 } from './ch4.js';
import { ch5 } from './ch5.js';
import { ch6 } from './ch6.js';

export const WHO = {
  H: ['Homelander', '#ff6a6a', 104], S: ['Starlight', '#fff2a8', 215], M: ['Queen Maeve', '#d6b3ff', 185], A: ['A-Train', '#7ab8ff', 128],
  D: ['The Deep', '#6fe3d8', 118], SB: ['Soldier Boy', '#ffa04a', 98], BU: ['Butcher', '#ececec', 112], HU: ['Hughie', '#a8d0ff', 150],
  MM: ['Mother’s Milk', '#c9ff9a', 90], F: ['Frenchie', '#ffb0d0', 125], K: ['Kimiko', '#ffffff', 0], E: ['Stan Edgar', '#cfd3da', 94],
  ASH: ['Ashley', '#ffd0e0', 205], N: ['Rep. Neuman', '#ff9ab0', 190], G: ['General Hale', '#b0d890', 84], ADV: ['Combine Broadcast', '#7fe8ff', 64],
  RAD: ['Radio', '#d8e8ff', 140], PIL: ['Pilot', '#d8e8ff', 135], NOIR: ['Black Noir', '#cfcfcf', 0], NAR: ['', '#9fd8f4', 0],
};

const WAR_CLOCK = [[46, 0], [142, 3600], [232, 7200], [300, 10800], [350, 14400], [410, 18000], [515, 21600], [530, 25200]];

export async function buildFilm(film, progress) {
  const W = {};
  const mk = async (k, ctor, p) => { W[k] = film.addWorld(new ctor(film)); await progress(p); };
  await mk('vegas', VegasWorld, 0.12);
  await mk('ny', NYWorld, 0.35);
  await mk('board', BoardWorld, 0.5);
  await mk('sit', SitWorld, 0.62);
  await mk('hide', HideWorld, 0.72);
  await mk('corr', CorrWorld, 0.82);
  await mk('air', AirWorld, 0.9);

  const shots = []; film.subs = []; film.overlays = []; film.flashes = []; film.cues = [];
  const talk = {};
  const pb = Array.from({ length: 6 }, () => new PathB());
  const x = {
    W, film, pb,
    shot: (t0, t1, world, cam, o = {}) => shots.push({ t0, t1, world, cam, ...o }),
    cue: (t, name, args = {}, world = null) => film.cue(t, name, args, world),
    say: (key, t0, dur, text, o = {}) => {
      const [name, color, pitch] = WHO[key];
      film.subs.push({ t0, t1: t0 + dur, who: o.radio ? name + ' (radio)' : name, color, text, voice: { pitch: pitch > 160 ? 1.35 : pitch < 100 ? 0.65 : 0.9, v: Object.keys(WHO).indexOf(key) } });
      (talk[key] = talk[key] || []).push([t0 - 0.1, t0 + dur]);
      if (pitch && !o.silent) film.cue(t0, 'say', { dur: dur * 0.95, pitch, robot: key === 'ADV' || o.radio, g: o.radio ? 0.03 : 0.045 });
    },
    sp: (key, T) => (talk[key] || []).some((r) => T >= r[0] && T <= r[1]),
    chapter: (t0, t1, text, sub) => film.overlays.push({ kind: 'chapter', t0, t1, text, sub }),
    title: (t0, t1, text, sub) => film.overlays.push({ kind: 'title', t0, t1, text, sub }),
    memo: (t0, t1, text, sub) => film.overlays.push({ kind: 'memo', t0, t1, text, sub }),
    loc: (t0, t1, text) => film.overlays.push({ kind: 'loc', t0, t1, text }),
    lower: (t0, t1, text, sub, color) => film.overlays.push({ kind: 'name', t0, t1, text, sub, color }),
    flash: (t, dur = 0.25) => film.flashes.push({ t, dur }),
  };
  ch1(x); await progress(0.92);
  ch2(x); ch3(x); await progress(0.95);
  ch4(x); ch5(x); ch6(x);
  W.ny.Spath = pb.map((b, i) => (b.k.length ? b.build() : null));
  W.ny.finalize();
  shots.sort((a, b) => a.t0 - b.t0);
  // sanity: continuity
  let last = 0;
  for (const s of shots) { if (Math.abs(s.t0 - last) > 0.001 && s.t0 !== last) console.warn('shot gap/overlap at', last, '->', s.t0); last = s.t1; }
  film.shots = shots; film.total = 600;
  film.clockAt = (T) => {
    if (T < 46 || T > 560) return '';
    const s = Math.round(kf(WAR_CLOCK, T)); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0, sec = s % 60;
    return 'WAR CLOCK  T+' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };
  await progress(1);
}
