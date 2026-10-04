import { clamp } from './util.js';
import { WORDS, PAUSES, estDur } from './lines.js';

/* Text-to-speech that is driven by the engine's own start/end events so a line is
   never cut off:
   - each line is spoken once, queued strictly one at a time (never cancelled by the next subtitle);
   - speaking starts slightly early (measured latency) so audio lines up with the picture;
   - the speaking rate is fitted to the subtitle window using a per-voice speed measured from earlier lines;
   - if a line still isn't finished when its window closes, the film clock eases to a crawl until the
     engine reports "end" (the subtitle stays up meanwhile), so the next line can never talk over it;
   - the next line only starts after the previous one has confirmed it ended. */

const PROFILE = {
  // key: [gender, pitch, rate multiplier, prefers british]
  H: ['m', 0.82, 1.0, false], S: ['f', 1.12, 1.02, false], M: ['f', 0.92, 0.98, false], A: ['m', 1.02, 1.06, false], D: ['m', 1.08, 1.02, false],
  SB: ['m', 0.7, 0.98, false], BU: ['m', 0.78, 1.0, true], HU: ['m', 1.18, 1.04, true], MM: ['m', 0.6, 0.96, false], F: ['m', 1.0, 1.02, false],
  E: ['m', 0.68, 0.94, false], ASH: ['f', 1.3, 1.08, false], N: ['f', 1.05, 1.0, false], G: ['m', 0.55, 0.98, false], ADV: ['m', 0.5, 0.88, false],
  RAD: ['m', 1.0, 1.1, false], PIL: ['m', 1.08, 1.12, false],
};
const FEM = /female|zira|samantha|susan|karen|moira|tessa|victoria|aria|jenny|hazel|serena|fiona|kate|allison|ava|joanna|salli|kimberly|emma|amy|libby|sonia|natasha|clara/i;
const MALE = /\bmale\b|david|mark|daniel|alex|fred|george|guy|james|ryan|thomas|oliver|arthur|brian|eric|matthew|joey|justin|liam|rishi|connor|davis/i;

export class Speech {
  constructor(film) {
    this.film = film;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
    this.enabled = false;
    this.lines = []; this.idx = 0; this.cur = null; this.latency = 0.18;
    this.wps = {}; this.voices = []; this.vcache = {};
    this._seeked = true; this._lastT = 0;
  }
  loadVoices() {
    if (!this.supported) return;
    const get = () => { this.voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); this.vcache = {}; };
    get(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', get);
  }
  setLines(subs) {
    this.lines = subs.filter((s) => s.speak !== false && s.text && !/^\s*\[/.test(s.text)).sort((a, b) => a.t0 - b.t0);
    this.idx = 0;
  }
  enable(on) {
    this.enabled = !!on && this.supported;
    if (!this.enabled) this.cancel();
    else { this.loadVoices(); this.reset(this.film.T); }
  }
  cancel() { try { this.supported && speechSynthesis.cancel(); } catch (e) {} this.cur = null; this.film.holdLine = null; }
  reset(T) {
    this.cancel(); this._seeked = true;
    this.idx = this.lines.findIndex((l) => l.t1 > T);
    if (this.idx < 0) this.idx = this.lines.length;
    // a line we've seeked into the middle of is skipped, unless we're right at its start
    const l = this.lines[this.idx]; if (l && T > l.t0 + 0.45) this.idx++;
  }
  pause() { if (!this.enabled) return; try { speechSynthesis.pause(); } catch (e) {} }
  resume() { if (!this.enabled) return; try { speechSynthesis.resume(); } catch (e) {} }
  voiceFor(key) {
    if (this.vcache[key]) return this.vcache[key];
    const p = PROFILE[key] || ['m', 1, 1, false];
    const vs = this.voices; if (!vs.length) return null;
    let pool = vs.filter((v) => (p[0] === 'f' ? FEM.test(v.name) : !FEM.test(v.name) && (MALE.test(v.name) || true)));
    if (p[0] === 'm') { const m = pool.filter((v) => MALE.test(v.name)); if (m.length) pool = m; }
    if (p[3]) { const gb = pool.filter((v) => /en[-_]GB|british|uk/i.test(v.lang + v.name)); if (gb.length) pool = gb; }
    if (!pool.length) pool = vs;
    const keys = Object.keys(PROFILE); const i = keys.indexOf(key);
    return (this.vcache[key] = pool[(i < 0 ? 0 : i) % pool.length]);
  }
  // Called every frame before the clock advances. Returns the time scale for this frame.
  timeScale(T, dt) {
    if (!this.enabled) return 1;
    const c = this.cur;
    if (c && !c.ended) {
      // waiting for the start event?
      if (!c.started) {
        if (T >= c.line.t0 && performance.now() - c.spoken < 900) return 0; // hold at the line start (max 0.9 s)
        if (performance.now() - c.spoken >= 1500) { c.ended = true; this.cur = null; return 1; } // engine never started: give up
        return 1;
      }
      if (T >= c.line.t1) {
        c.hold += dt;
        if (c.hold > 3.5 || performance.now() - c.started > c.limit) { try { speechSynthesis.cancel(); } catch (e) {} c.ended = true; this.cur = null; this.film.holdLine = null; return 1; }
        const nx = this.lines[this.idx];
        if (nx && T >= nx.t0 - 0.02) return 0; // never run into the next line
        this.film.holdLine = c.line;
        return 0.18; // ease to a crawl until the engine says it has finished
      }
    }
    return 1;
  }
  update(T, playing) {
    if (!this.enabled || !playing) return;
    // retire finished line
    if (this.cur && this.cur.ended) { this.cur = null; this.film.holdLine = null; }
    if (this.cur) return; // one line at a time
    const l = this.lines[this.idx]; if (!l) return;
    const lead = clamp(this.latency, 0.05, 0.6);
    if (T >= l.t0 - lead) {
      if (T > l.t1 - 0.3 && !this._seeked) { this.idx++; return; } // far too late (e.g. after a long stall)
      this.idx++; this._seeked = false; this.speak(l);
    }
  }
  speak(l) {
    const key = l.key; const prof = PROFILE[key] || ['m', 1, 1, false];
    const v = this.voiceFor(key);
    const u = new SpeechSynthesisUtterance(l.text.replace(/\[.*?\]/g, '').replace(/—|…/g, ', '));
    if (v) u.voice = v;
    const vk = v ? v.name : 'default';
    const wps1 = this.wps[vk] || 2.6;
    const win = Math.max(0.8, l.t1 - l.t0);
    const pred1 = WORDS(l.text) / wps1 + PAUSES(l.text) * 0.16 + 0.15; // seconds at rate 1
    const rate = clamp((pred1 / (win * 0.9)) * 1.0, 0.95, 1.4) * prof[2];
    u.rate = clamp(rate, 0.8, 1.6); u.pitch = prof[1]; u.volume = 1;
    const c = { line: l, started: 0, ended: false, hold: 0, spoken: performance.now(), rate: u.rate, vk, limit: (pred1 / u.rate) * 1000 * 2.2 + 3500 };
    u.onstart = () => { c.started = performance.now(); this.latency = this.latency * 0.6 + ((c.started - c.spoken) / 1000) * 0.4; this.film.talkingNow = l.key; };
    const done = () => {
      if (c.ended) return; c.ended = true;
      if (c.started) { // learn this voice's real speed
        const dur = (performance.now() - c.started) / 1000;
        const eff = Math.max(0.3, dur - PAUSES(l.text) * 0.12 / c.rate); const m = (WORDS(l.text) / eff) / c.rate;
        if (isFinite(m) && m > 1.2 && m < 6) this.wps[c.vk] = (this.wps[c.vk] || 2.6) * 0.5 + m * 0.5;
      }
      this.film.talkingNow = null;
    };
    u.onend = done; u.onerror = done;
    this.cur = c;
    try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { c.ended = true; this.cur = null; }
  }
  get speakingKey() { return this.cur && this.cur.started && !this.cur.ended ? this.cur.line.key : null; }
}
