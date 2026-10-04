import { clamp, lerp, hash, kf, smooth } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const BPM = [[0, 56], [10, 72], [26, 112], [34, 56], [42, 66], [100, 74], [142, 84], [160, 120], [232, 74], [250, 128], [300, 62], [350, 100], [376, 58], [392, 124], [410, 128], [470, 136], [515, 56], [560, 60]];
const TENSION = [[0, 0.22], [8, 0.4], [14, 0.62], [26, 0.9], [33, 0.95], [35, 0.08], [41, 0.1], [48, 0.18], [75, 0.25], [100, 0.3], [125, 0.42], [142, 0.5], [158, 0.75], [185, 0.8], [200, 0.9], [230, 0.9], [236, 0.4], [250, 0.7], [268, 0.95], [296, 0.9], [302, 0.3], [330, 0.45], [348, 0.6], [360, 0.75], [374, 0.85], [380, 0.18], [392, 0.5], [398, 0.95], [408, 0.9], [416, 0.85], [455, 0.95], [490, 1.0], [506, 1.0], [512, 0.3], [520, 0.12], [545, 0.2], [570, 0.25], [590, 0.1], [600, 0.0]];
const ROOT = [[0, 38], [142, 38], [232, 36], [300, 38], [350, 33], [410, 38], [515, 31], [560, 38]]; // D2 etc.
const PROG = [0, -4, -2, -7]; // minor-ish progression (semitones)

const AMB = {
  vegas: { f: 500, g: 0.06 }, ny: { f: 600, g: 0.07 }, air: { f: 420, g: 0.06 },
  board: { f: 180, g: 0.015 }, sit: { f: 220, g: 0.02 }, hide: { f: 160, g: 0.02 }, corr: { f: 140, g: 0.03 },
};

export class Audio {
  constructor(film) { this.film = film; this.ctx = null; this.playing = false; this.muted = false; this.cueI = 0; this.cueT = 0; this.stepI = 0; this.speech = false; }

  start(speech) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.speech = !!speech;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    // reverb
    this.rev = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, ib = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev.buffer = ib; this.revG = ctx.createGain(); this.revG.gain.value = 0.32; this.rev.connect(this.revG); this.revG.connect(this.master);
    // noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.nbuf = nb;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.9; this.musicBus.connect(this.master); this.musicBus.connect(this.rev);
    this._newBus();
    this._beds();
    this.film.cues.sort((a, b) => a.t - b.t);
    this._steps();
    this.reset(this.film.T);
    if (this.speech && window.speechSynthesis) {
      this.film.onLine = (l) => { try { speechSynthesis.cancel(); if (l && l.speak !== false && this.playing) this._tts(l); } catch (e) {} };
    }
    this.playing = true;
    if (ctx.state === 'suspended') ctx.resume();
  }
  _tts(l) {
    const u = new SpeechSynthesisUtterance(l.text.replace(/\[.*?\]/g, ''));
    const vs = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
    const sp = l.voice || {};
    if (vs.length) u.voice = vs[(sp.v ?? 0) % vs.length];
    u.pitch = sp.pitch ?? 1; u.rate = sp.rate ?? 1.05; u.volume = 0.9;
    speechSynthesis.speak(u);
  }
  setPlaying(p) { this.playing = p; if (!this.ctx) return; if (p) { this.ctx.resume(); this.reset(this.film.T); } else { this.ctx.suspend(); window.speechSynthesis && speechSynthesis.cancel(); } }
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.85; }
  _newBus() {
    if (this.bus) { try { this.bus.disconnect(); } catch (e) {} }
    this.bus = this.ctx.createGain(); this.bus.gain.value = 1; this.bus.connect(this.master);
    this.send = this.ctx.createGain(); this.send.gain.value = 0.5; this.bus.connect(this.send); this.send.connect(this.rev);
  }
  reset(T) {
    if (!this.ctx) return;
    this._newBus();
    const c = this.film.cues; let lo = 0, hi = c.length; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m].t < T) lo = m + 1; else hi = m; }
    this.cueI = lo; this.cueT = T;
    const s = this.steps; lo = 0; hi = s.length; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < T) lo = m + 1; else hi = m; }
    this.stepI = lo;
    window.speechSynthesis && speechSynthesis.cancel();
  }
  _steps() {
    const out = []; let t = 0;
    while (t < 602) { out.push(t); const bpm = kf(BPM, t); t += 60 / bpm / 4; }
    this.steps = out;
  }
  _beds() {
    const ctx = this.ctx;
    const mk = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    // wind / room
    this.wind = ctx.createBufferSource(); this.wind.buffer = this.nbuf; this.wind.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.6;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    this.wind.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.musicBus); this.wind.start();
    // pad
    this.padF = ctx.createBiquadFilter(); this.padF.type = 'lowpass'; this.padF.frequency.value = 400; this.padF.Q.value = 0.7;
    this.padG = ctx.createGain(); this.padG.gain.value = 0;
    this.pads = [mk('sawtooth', 73), mk('sawtooth', 73.5), mk('sawtooth', 110), mk('sawtooth', 87)];
    this.pads.forEach((o) => { o.connect(this.padF); o.start(); });
    this.padF.connect(this.padG); this.padG.connect(this.musicBus);
    // sub
    this.sub = mk('sine', 36); this.subG = ctx.createGain(); this.subG.gain.value = 0; this.sub.connect(this.subG); this.subG.connect(this.musicBus); this.sub.start();
    // strings high
    this.strF = ctx.createBiquadFilter(); this.strF.type = 'lowpass'; this.strF.frequency.value = 1800;
    this.strG = ctx.createGain(); this.strG.gain.value = 0;
    this.strs = [mk('sawtooth', 293), mk('sawtooth', 294), mk('sawtooth', 349), mk('sawtooth', 440)];
    this.strs.forEach((o) => { o.connect(this.strF); o.start(); });
    this.strF.connect(this.strG); this.strG.connect(this.musicBus);
    // vibrato lfo for strings
    const l = mk('sine', 5.2); const lg = ctx.createGain(); lg.gain.value = 4; l.connect(lg); this.strs.forEach((o) => lg.connect(o.detune)); l.start();
  }
  // ---------- per-frame ----------
  sync(T, playing) {
    if (!this.ctx || !playing) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const ten = kf(TENSION, T);
    const root = kf(ROOT.map(([t, v]) => [t, v]), T) | 0;
    const rootNow = ROOT.reduce((a, [t, v]) => (T >= t ? v : a), ROOT[0][1]);
    const bpm = kf(BPM, T), beat = 60 / bpm;
    const chord = PROG[Math.floor(T / (beat * 8)) % 4];
    const r = rootNow + chord;
    const tc = 0.35;
    this.pads[0].frequency.setTargetAtTime(mtof(r + 12), now, tc); this.pads[1].frequency.setTargetAtTime(mtof(r + 12) * 1.004, now, tc);
    this.pads[2].frequency.setTargetAtTime(mtof(r + 19), now, tc); this.pads[3].frequency.setTargetAtTime(mtof(r + 15), now, tc);
    this.padF.frequency.setTargetAtTime(280 + 2200 * ten * ten, now, 0.3);
    this.padG.gain.setTargetAtTime(0.045 + 0.075 * ten, now, 0.4);
    this.sub.frequency.setTargetAtTime(mtof(r), now, tc); this.subG.gain.setTargetAtTime(0.16 + 0.22 * ten, now, 0.3);
    const sm = (ten - 0.55) * 2.2; this.strG.gain.setTargetAtTime(clamp(sm) * 0.05, now, 0.5);
    const s0 = r + 24; [0, 3, 7, 12].forEach((iv, i) => this.strs[i].frequency.setTargetAtTime(mtof(s0 + iv - (i === 1 ? 0 : 0)), now, 0.4));
    // ambience per world
    const w = this.film.curWorld ? this.film.curWorld.name : 'ny'; const a = AMB[w] || AMB.ny;
    this.windF.frequency.setTargetAtTime(a.f * (1 + 0.5 * Math.sin(T * 0.3)), now, 0.4); this.windG.gain.setTargetAtTime(a.g * (0.6 + ten * 0.8), now, 0.4);
    // schedule cues
    const L = 0.45, tAhead = T + L; const cues = this.film.cues;
    while (this.cueI < cues.length && cues[this.cueI].t < tAhead) {
      const c = cues[this.cueI++];
      if (c.t < T - 0.25) continue;
      if (c.world) { const sh = this.film.shotAt(c.t); if (sh && sh.world !== c.world) continue; }
      const when = Math.max(now, now + (c.t - T));
      try { this._cue(c, when); } catch (e) { /* ignore */ }
    }
    // music steps
    const st = this.steps;
    while (this.stepI < st.length && st[this.stepI] < tAhead) {
      const i = this.stepI++; const ts = st[i]; if (ts < T - 0.2) continue;
      const when = Math.max(now, now + (ts - T));
      this._step(i, ts, when, kf(TENSION, ts), kf(BPM, ts));
    }
  }
  _step(i, ts, when, ten, bpm) {
    const k = i % 16, bar = (i / 16) | 0;
    const rootNow = ROOT.reduce((a, [t, v]) => (ts >= t ? v : a), ROOT[0][1]);
    const r = rootNow + PROG[Math.floor(ts / (60 / bpm * 8)) % 4];
    const bt = 60 / bpm / 4;
    // ostinato
    if (ten > 0.38) {
      const pat = [1, 0, 0.55, 0, 0.8, 0, 0.55, 0.4, 1, 0, 0.55, 0, 0.8, 0.5, 0.4, 0];
      const g = pat[k]; if (g) { const iv = [0, 0, 12, 0, 7, 0, 3, 12, 0, 0, 12, 0, 7, 3, 0, 0][k]; this._pluck(when, mtof(r + 12 + iv), bt * 1.6, 0.05 * g * (0.4 + ten)); }
    }
    if (ten > 0.55) {
      if (k === 0 || k === 8 || (ten > 0.8 && (k === 6 || k === 14))) this._kick(when, 0.5 + 0.3 * ten);
      if (k === 0 && ten > 0.7) this._taiko(when, 0.7);
      if (ten > 0.85 && (k === 4 || k === 12)) this._snare(when, 0.28);
      if (ten > 0.9 && k % 2 === 0) this._hat(when, 0.08);
    }
    if (ten > 0.7 && k === 0 && bar % 2 === 0) this._brass(when, mtof(r + 12), bt * 14, 0.07);
    if (ten < 0.3 && k === 0 && bar % 2 === 0) this._bell(when, mtof(r + 36 + [0, 3, 7, 10][bar % 4]), 0.05);
  }
  // ---------- synth primitives ----------
  _env(g, t, a, d, peak, sus = 0, rel = 0.05) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); }
  tone(t, dur, o = {}) {
    const ctx = this.ctx; const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0 || 200, t); if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + dur * (o.fk || 1));
    const g = ctx.createGain(); this._env(g, t, o.a ?? 0.005, dur, o.gain ?? 0.3);
    let out = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + dur); f.Q.value = o.q || 0.7; osc.connect(f); out = f; }
    out.connect(g); (o.bus || this.bus) && g.connect(o.dest || this.bus);
    osc.start(t); osc.stop(t + dur + 0.1);
    if (o.vib) { const l = ctx.createOscillator(); l.frequency.value = o.vib[0]; const lg = ctx.createGain(); lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.1); }
    return g;
  }
  noise(t, dur, o = {}) {
    const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this.nbuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f0 || 1000, t); if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur); f.Q.value = o.q || 0.7;
    const g = ctx.createGain(); const a = o.a ?? 0.005; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.gain ?? 0.3, t + a);
    if (o.hold) g.gain.setValueAtTime(o.gain ?? 0.3, t + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    let out = g; if (o.pan != null) { const p = ctx.createStereoPanner(); p.pan.setValueAtTime(o.pan, t); if (o.pan1 != null) p.pan.linearRampToValueAtTime(o.pan1, t + dur); g.connect(p); out = p; }
    out.connect(this.bus); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
    return g;
  }
  _pluck(t, f, dur, gain) { const g = this.tone(t, dur, { type: 'sawtooth', f0: f, gain, lp: 1400, lp1: 200, dest: this.musicBus, a: 0.003 }); }
  _kick(t, g) { this.tone(t, 0.32, { type: 'sine', f0: 140, f1: 38, gain: g, dest: this.musicBus, fk: 0.5 }); this.noise(t, 0.03, { type: 'highpass', f0: 1800, gain: g * 0.2 }); }
  _taiko(t, g) { this.tone(t, 0.9, { type: 'sine', f0: 95, f1: 42, gain: g * 0.9, dest: this.musicBus }); this.noise(t, 0.25, { type: 'lowpass', f0: 600, f1: 120, gain: g * 0.4 }); }
  _snare(t, g) { this.noise(t, 0.16, { type: 'bandpass', f0: 1800, q: 0.8, gain: g }); this.tone(t, 0.1, { type: 'triangle', f0: 220, f1: 140, gain: g * 0.6, dest: this.musicBus }); }
  _hat(t, g) { this.noise(t, 0.04, { type: 'highpass', f0: 7000, gain: g }); }
  _bell(t, f, g) { this.tone(t, 3.2, { type: 'sine', f0: f, gain: g, a: 0.01, dest: this.musicBus }); this.tone(t, 2.2, { type: 'sine', f0: f * 2.76, gain: g * 0.35, a: 0.01, dest: this.musicBus }); }
  _brass(t, f, dur, gain) {
    const ctx = this.ctx;
    [1, 1.005, 0.5].forEach((m, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(250, t); fl.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.35); fl.frequency.exponentialRampToValueAtTime(300, t + dur); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(fl); fl.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.1); });
  }

  // ---------- cue dispatch ----------
  _cue(c, t) {
    const a = c.args || {}; const n = c.name;
    switch (n) {
      case 'explosion': return this.explosion(t, a.s || 1);
      case 'strider_fire': return this.striderFire(t);
      case 'gunship_fire': return this.autofire(t, a.dur || 1, 22, 0.16, 2200);
      case 'autofire': return this.autofire(t, a.dur || 1, a.rate || 14, a.g || 0.14, a.f || 1800);
      case 'horn': return this.horn(t, a.dur || 4, a.f || 52, a.g || 0.5);
      case 'thunder': return this.thunder(t, a.dur || 3);
      case 'stomp': return this.stomp(t, a.g || 0.8);
      case 'steps': for (let i = 0; i < (a.n || 4); i++) this.stomp(t + i * (a.dt || 0.85), (a.g || 0.6) * (0.9 + 0.1 * (i % 2))); return;
      case 'jet': return this.jet(t, a.dur || 3, a.pan0 ?? -1, a.pan1 ?? 1, a.g || 0.5);
      case 'burner': return this.burner(t, a.dur || 5, a.g || 0.4);
      case 'punch': return this.punch(t, a.g || 0.7);
      case 'laser': return this.laser(t, a.dur || 1, a.g || 0.25);
      case 'zap': return this.zap(t, a.dur || 0.5, a.g || 0.25);
      case 'heartbeat': for (let i = 0; i < (a.n || 4); i++) { this.tone(t + i * 0.9, 0.18, { type: 'sine', f0: 62, f1: 40, gain: 0.5, dest: this.musicBus }); this.tone(t + i * 0.9 + 0.2, 0.2, { type: 'sine', f0: 54, f1: 36, gain: 0.35, dest: this.musicBus }); } return;
      case 'siren': return this.siren(t, a.dur || 6, a.g || 0.07);
      case 'rotor': return this.rotor(t, a.dur || 5, a.g || 0.25);
      case 'radio': return this.radio(t);
      case 'screech': return this.screech(t, a.g || 0.25);
      case 'crabs': for (let i = 0; i < (a.n || 6); i++) this.screech(t + i * (a.dt || 0.35) + hash(i) * 0.2, (a.g || 0.12) * (0.6 + 0.4 * hash(i * 3))); return;
      case 'moan': return this.moan(t, a.dur || 1.6, a.g || 0.2, a.f || 90);
      case 'scream': return this.scream(t, a.g || 0.12);
      case 'crowd': for (let i = 0; i < (a.n || 5); i++) this.scream(t + i * 0.4 + hash(i) * 0.3, (a.g || 0.07) * (0.5 + hash(i * 2))); return;
      case 'whoosh': return this.whoosh(t, a.dur || 1, a.g || 0.3);
      case 'hit': return this.hit(t, a.g || 1);
      case 'riser': return this.riser(t, a.dur || 4, a.g || 0.2);
      case 'glass': return this.glass(t);
      case 'door': return this.door(t);
      case 'tick': return this.tone(t, 0.08, { type: 'square', f0: 900, f1: 500, gain: 0.08 });
      case 'static': return this.noise(t, a.dur || 0.3, { type: 'bandpass', f0: 2000, q: 0.5, gain: a.g || 0.1 });
      case 'portal': return this.portal(t, a.dur || 6, a.g || 0.3);
      case 'dropship': return this.dropship(t, a.dur || 6, a.g || 0.3);
      case 'beam': return this.beamSfx(t, a.dur || 1);
      case 'bell': return this._bell(t, mtof(a.m || 74), a.g || 0.12);
      case 'stab': return this._brass(t, mtof(a.m || 50), a.dur || 2.2, a.g || 0.13);
      case 'melody': return this.melody(t, a.notes, a.g || 0.14, a.type || 'triangle');
      case 'say': return this.say(t, a.dur || 2, a.pitch || 120, a.g || 0.04, a.robot);
      case 'fire': return this.noise(t, a.dur || 6, { type: 'bandpass', f0: 900, q: 0.4, gain: a.g || 0.08, a: 1, hold: (a.dur || 6) - 1 });
      case 'impactdist': return this.explosion(t, a.s || 0.5);
      default: return;
    }
  }
  explosion(t, s = 1) {
    s = clamp(s, 0.3, 4);
    this.tone(t, 0.8 + 0.25 * s, { type: 'sine', f0: 130, f1: 28, gain: 0.85 * Math.min(1.4, 0.5 + s * 0.4), fk: 0.8 });
    this.noise(t, 1.0 + 0.4 * s, { type: 'lowpass', f0: 3400, f1: 120, gain: 0.55 * Math.min(1.3, 0.4 + s * 0.4), q: 0.5 });
    this.noise(t, 0.12, { type: 'highpass', f0: 1500, gain: 0.35 });
    if (s > 1.4) this.noise(t + 0.25, 2.2, { type: 'lowpass', f0: 500, f1: 60, gain: 0.25, a: 0.2 });
  }
  striderFire(t) {
    this.tone(t, 0.6, { type: 'sawtooth', f0: 1100, f1: 90, gain: 0.3, lp: 3000, lp1: 200 });
    this.tone(t + 0.02, 0.9, { type: 'sine', f0: 75, f1: 30, gain: 0.8 });
    this.noise(t, 0.7, { type: 'bandpass', f0: 3000, f1: 400, q: 1.2, gain: 0.3 });
  }
  autofire(t, dur, rate, g, f) { const n = Math.floor(dur * rate); for (let i = 0; i < n; i++) { const tt = t + i / rate + hash(i * 1.3) * 0.01; this.noise(tt, 0.05, { type: 'bandpass', f0: f, q: 0.7, gain: g * (0.6 + 0.4 * hash(i)) }); if (i % 2 === 0) this.tone(tt, 0.06, { type: 'sine', f0: 140, f1: 70, gain: g * 0.7 }); } }
  horn(t, dur = 4, f = 52, g = 0.5) {
    const ctx = this.ctx;
    [[1, 'sawtooth'], [1.5, 'sawtooth'], [2.003, 'square'], [0.5, 'sine']].forEach(([m, ty], i) => {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.setValueAtTime(f * m * 1.18, t); o.frequency.exponentialRampToValueAtTime(f * m, t + dur * 0.6);
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(180, t); fl.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.22); fl.frequency.exponentialRampToValueAtTime(200, t + dur);
      const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g * (i === 3 ? 1.2 : 0.4), t + dur * 0.2); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(gg); gg.connect(this.bus); o.start(t); o.stop(t + dur + 0.2);
    });
    this.noise(t, dur * 0.7, { type: 'lowpass', f0: 300, f1: 80, gain: 0.2, a: dur * 0.15 });
  }
  thunder(t, dur) { this.noise(t, dur, { type: 'lowpass', f0: 500, f1: 50, gain: 0.6, a: dur * 0.12, q: 0.5 }); this.noise(t + 0.05, 0.3, { type: 'highpass', f0: 1200, gain: 0.25 }); }
  stomp(t, g) { this.tone(t, 0.45, { type: 'sine', f0: 78, f1: 30, gain: g, fk: 0.7 }); this.noise(t, 0.2, { type: 'bandpass', f0: 600, q: 1.2, gain: g * 0.35 }); this.noise(t + 0.02, 0.5, { type: 'lowpass', f0: 250, gain: g * 0.4 }); }
  jet(t, dur, p0, p1, g) { this.noise(t, dur, { type: 'bandpass', f0: 250, f1: 2600, q: 0.9, gain: g, a: dur * 0.45, pan: p0, pan1: p1 }); this.noise(t + dur * 0.4, dur * 0.8, { type: 'lowpass', f0: 1800, f1: 200, gain: g * 0.6, a: 0.05, pan: p0, pan1: p1 }); }
  burner(t, dur, g) { this.noise(t, dur, { type: 'lowpass', f0: 900, f1: 1500, gain: g, a: dur * 0.3 }); this.noise(t, dur, { type: 'highpass', f0: 2500, gain: g * 0.3, a: dur * 0.3 }); }
  punch(t, g) { this.tone(t, 0.3, { type: 'sine', f0: 110, f1: 40, gain: g }); this.noise(t, 0.12, { type: 'lowpass', f0: 1800, f1: 200, gain: g * 0.6 }); }
  laser(t, dur, g) { this.tone(t, dur, { type: 'sawtooth', f0: 1500, f1: 1750, gain: g, lp: 3000, a: 0.02, vib: [38, 80] }); this.noise(t, dur, { type: 'highpass', f0: 3200, gain: g * 0.6, a: 0.03 }); }
  zap(t, dur, g) { for (let i = 0; i < 8; i++) this.noise(t + i * dur / 8, dur / 6, { type: 'highpass', f0: 2500 + hash(i) * 2000, gain: g * (0.5 + 0.5 * hash(i + 4)) }); this.tone(t, dur, { type: 'sawtooth', f0: 1800, f1: 400, gain: g * 0.5, lp: 4000 }); }
  siren(t, dur, g) { const o = this.ctx.createOscillator(); o.type = 'sine'; for (let i = 0; i * 2 < dur; i++) { o.frequency.setValueAtTime(520, t + i * 2); o.frequency.linearRampToValueAtTime(820, t + i * 2 + 1); o.frequency.linearRampToValueAtTime(520, t + i * 2 + 2); } const gg = this.ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + 1); gg.gain.setValueAtTime(g, t + dur - 1); gg.gain.linearRampToValueAtTime(0.0001, t + dur); const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f); f.connect(gg); gg.connect(this.bus); o.start(t); o.stop(t + dur + 0.1); }
  rotor(t, dur, g) {
    const ctx = this.ctx; const s = ctx.createBufferSource(); s.buffer = this.nbuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.linearRampToValueAtTime(g, t + dur * 0.3); gg.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = g * 0.6; lfo.connect(lg); lg.connect(gg.gain);
    s.connect(f); f.connect(gg); gg.connect(this.bus); s.start(t); s.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
  }
  radio(t) { this.tone(t, 0.06, { type: 'sine', f0: 1500, gain: 0.07 }); this.noise(t + 0.06, 0.14, { type: 'bandpass', f0: 1800, q: 0.6, gain: 0.08 }); this.tone(t + 0.3, 0.05, { type: 'sine', f0: 1100, gain: 0.05 }); }
  screech(t, g) { this.noise(t, 0.4, { type: 'bandpass', f0: 2400, f1: 3600, q: 5, gain: g, a: 0.02 }); this.tone(t, 0.35, { type: 'sawtooth', f0: 1200, f1: 2400, gain: g * 0.3, lp: 4000, vib: [42, 200] }); }
  moan(t, dur, g, f) { this.tone(t, dur, { type: 'sawtooth', f0: f * 1.3, f1: f * 0.8, gain: g, lp: 600, lp1: 250, a: dur * 0.3, vib: [5, 6] }); this.noise(t, dur, { type: 'bandpass', f0: 500, f1: 280, q: 2, gain: g * 0.5, a: dur * 0.3 }); }
  scream(t, g) { const d = 0.9 + hash(t) * 0.7; this.tone(t, d, { type: 'sawtooth', f0: 600 + hash(t * 3) * 400, f1: 1000 + hash(t * 5) * 500, gain: g, lp: 3200, a: 0.05, vib: [7, 40], bus: 1 }); this.noise(t, d, { type: 'bandpass', f0: 2200, q: 1.5, gain: g * 0.4, a: 0.05 }); }
  whoosh(t, dur, g) { this.noise(t, dur, { type: 'bandpass', f0: 300, f1: 2600, q: 0.8, gain: g, a: dur * 0.5 }); }
  hit(t, g) { this.tone(t, 1.6, { type: 'sine', f0: 90, f1: 26, gain: 0.9 * g }); this.noise(t, 0.9, { type: 'lowpass', f0: 2600, f1: 90, gain: 0.5 * g }); this._brass(t, mtof(38), 2.4, 0.12 * g); }
  riser(t, dur, g) { this.tone(t, dur, { type: 'sawtooth', f0: 80, f1: 900, gain: g, lp: 400, lp1: 5000, a: dur * 0.9, fk: 1 }); this.noise(t, dur, { type: 'bandpass', f0: 400, f1: 6000, q: 1, gain: g * 0.9, a: dur * 0.95 }); }
  glass(t) { this.noise(t, 0.35, { type: 'highpass', f0: 3000, gain: 0.3 }); for (let i = 0; i < 9; i++) this.tone(t + 0.04 + i * 0.045, 0.2, { type: 'sine', f0: 3000 + hash(i * 3) * 3500, gain: 0.04 }); }
  door(t) { this.tone(t, 0.3, { type: 'sine', f0: 120, f1: 50, gain: 0.5 }); this.noise(t, 0.1, { type: 'bandpass', f0: 900, q: 2, gain: 0.3 }); this.noise(t + 0.12, 0.4, { type: 'bandpass', f0: 400, q: 3, gain: 0.12 }); }
  portal(t, dur, g) { [55, 82.7, 110.4].forEach((f, i) => this.tone(t, dur, { type: 'sawtooth', f0: f, f1: f * 1.2, gain: g * 0.4, lp: 300, lp1: 1200, a: dur * 0.5, vib: [0.4 + i * 0.3, 3] })); this.noise(t, dur, { type: 'bandpass', f0: 1000, f1: 3000, q: 2, gain: g * 0.3, a: dur * 0.7 }); }
  dropship(t, dur, g) { this.rotor(t, dur, g * 0.8); this.tone(t, dur, { type: 'sawtooth', f0: 70, f1: 62, gain: g * 0.4, lp: 400, a: dur * 0.3 }); }
  beamSfx(t, dur) { this.tone(t, dur, { type: 'sawtooth', f0: 220, f1: 880, gain: 0.12, lp: 2000, a: dur * 0.5, vib: [9, 30] }); }
  melody(t, notes, g, type) { (notes || []).forEach(([dt, m, d]) => this.tone(t + dt, d || 1.2, { type, f0: mtof(m), gain: g, a: 0.02, lp: 2400, dest: this.musicBus })); }
  say(t, dur, pitch, g, robot) {
    const n = Math.max(2, Math.floor(dur * 5.2));
    for (let i = 0; i < n; i++) {
      const tt = t + (i / n) * dur * 0.97; const f = pitch * (0.85 + hash(i * 5.1 + pitch) * 0.55) * (i === n - 1 ? 0.8 : 1);
      const fm = [500, 700, 400, 900, 600][(hash(i * 9.3 + pitch) * 5) | 0];
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, tt);
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm; bp.Q.value = 3.2;
      const gg = this.ctx.createGain(); const d = 0.07 + hash(i * 3.3) * 0.05; gg.gain.setValueAtTime(0.0001, tt); gg.gain.linearRampToValueAtTime(g * (0.5 + 0.5 * hash(i * 7.7)) * (robot ? 1.3 : 1), tt + 0.015); gg.gain.exponentialRampToValueAtTime(0.0001, tt + d);
      let out = bp;
      if (robot) { const rm = this.ctx.createGain(); rm.gain.value = 0; const lf = this.ctx.createOscillator(); lf.frequency.value = 62; const lg = this.ctx.createGain(); lg.gain.value = 1; lf.connect(lg); lg.connect(rm.gain); bp.connect(rm); out = rm; lf.start(tt); lf.stop(tt + d + 0.05); }
      o.connect(bp); out.connect(gg); gg.connect(this.bus); o.start(tt); o.stop(tt + d + 0.05);
    }
  }
}
