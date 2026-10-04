import * as THREE from 'three';
import { FXU } from './fx.js';
import { clamp, smooth } from './util.js';
import { Speech } from './speech.js';
import { Human } from './model/human.js';

export const ASPECT = 2.39;

export class World {
  constructor(film, name) {
    this.film = film; this.name = name;
    this.group = new THREE.Group(); this.group.visible = false; this.group.name = name;
    this.fogColor = 0x000000; this.fogDensity = 0.0;
    this.bg = 0x000000;
    this.sky = null;
    this.fx = null;
  }
  onEnter() {}
  update(T) {}
}

export class Film {
  constructor(dom, quality) {
    this.dom = dom;
    this.quality = quality;
    this.canvas = dom.canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'low-power', alpha: false, preserveDrawingBuffer: !!dom.preserve });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, ASPECT, 0.2, 6000);
    this.scene.add(this.camera);
    this.worlds = {};
    this.shots = [];
    this.overlays = [];
    this.flashes = [];
    this.subs = [];
    this.cues = [];
    this.total = 600;
    this.T = 0; this.playing = false;
    this.cur = null; this.curWorld = null;
    this.camFov = 40;
    this.audio = null;
    this.speech = new Speech(this); this.holdLine = null; this.talkingNow = null;
    this._lastTs = 0; this._lastRender = 0; this._intervals = [];
    this.scale = quality.scale;
    this.layout();
    addEventListener('resize', () => this.layout());
  }
  addWorld(w) { this.worlds[w.name] = w; this.scene.add(w.group); return w; }
  cue(t, name, args = {}, world = null) { this.cues.push({ t, name, args, world }); }

  layout() {
    const W = innerWidth, H = innerHeight;
    let w, h;
    if (W / H > ASPECT) { h = H; w = H * ASPECT; } else { w = W; h = W / ASPECT; }
    this.cssW = Math.round(w); this.cssH = Math.round(h);
    const st = this.dom.stage;
    st.style.width = this.cssW + 'px'; st.style.height = this.cssH + 'px';
    this.applyScale();
  }
  applyScale() {
    const dpr = this.quality.dpr ? Math.min(devicePixelRatio || 1, this.quality.dpr) : 1;
    const s = this.scale * dpr;
    const bw = Math.max(320, Math.round(this.cssW * s)), bh = Math.max(134, Math.round(this.cssH * s));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(bw, bh, false);
    this.canvas.style.width = this.cssW + 'px'; this.canvas.style.height = this.cssH + 'px';
    this.camera.aspect = ASPECT; this.camera.updateProjectionMatrix();
    this.bufH = bh;
  }

  shotAt(T) {
    const s = this.shots;
    if (this.cur && T >= this.cur.t0 && T < this.cur.t1) return this.cur;
    for (let i = 0; i < s.length; i++) if (T >= s[i].t0 && T < s[i].t1) return s[i];
    return s[s.length - 1];
  }

  seek(T) {
    this.T = clamp(T, 0, this.total - 0.001);
    this.audio && this.audio.reset(this.T);
    this.speech.reset(this.T);
    this._renderedSub = null;
  }

  frame(T) {
    Human.T = T; Human.talk = new Set(this.talkKeys || []);
    const shot = this.shotAt(T);
    if (shot !== this.cur) {
      if (this.curWorld) this.curWorld.group.visible = false;
      this.cur = shot;
      this.curWorld = this.worlds[shot.world];
      this.curWorld.group.visible = true;
      this.scene.background = new THREE.Color(this.curWorld.bg);
      this.scene.fog = this.curWorld.fogDensity > 0 ? new THREE.FogExp2(this.curWorld.fogColor, this.curWorld.fogDensity) : null;
      this.curWorld.onEnter && this.curWorld.onEnter(shot);
    }
    const w = this.curWorld;
    const k = { T, u: clamp((T - shot.t0) / (shot.t1 - shot.t0)), lt: T - shot.t0, dur: shot.t1 - shot.t0, cam: this.camera, w, film: this, shot };
    shot.cam(k);
    if (window.__camOverride) { const o = window.__camOverride; this.camera.position.set(o[0], o[1], o[2]); this.camera.lookAt(o[3], o[4], o[5]); this.camera.fov = o[6] || 40; this.camera.updateProjectionMatrix(); }
    w.update(T, k);
    if (w.fx) w.fx.update(T);
    shot.act && shot.act(k);
    if (this.scene.fog && w.fogAt) { const f = w.fogAt(T); this.scene.fog.density = f.density; this.scene.fog.color.set(f.color); this.scene.background.set(f.color); }
    FXU.uScale.value = this.bufH / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.renderer.render(this.scene, this.camera);
    this.updateOverlays(T, shot);
  }

  updateOverlays(T, shot) {
    const d = this.dom;
    // fades
    let black = 0;
    const lt = T - shot.t0, rt = shot.t1 - T;
    const hb = shot.holdBlack || 0;
    if (lt < hb) black = 1;
    else if (shot.fadeIn && lt - hb < shot.fadeIn) black = Math.max(black, 1 - (lt - hb) / shot.fadeIn);
    if (shot.fadeOut && rt < shot.fadeOut) black = Math.max(black, 1 - rt / shot.fadeOut);
    let fl = 0;
    for (const f of this.flashes) if (T >= f.t && T < f.t + f.dur) fl = Math.max(fl, 1 - (T - f.t) / f.dur);
    if (shot.hold) black = Math.max(black, shot.hold);
    this._set(d.fade, 'op', black.toFixed(3), () => (d.fade.style.opacity = black));
    this._set(d.flash, 'op', fl.toFixed(3), () => (d.flash.style.opacity = fl));
    // overlays
    let chap = null, lower = null, loc = null, big = null;
    for (const o of this.overlays) {
      if (T < o.t0 || T > o.t1) continue;
      if (o.kind === 'chapter') chap = o; else if (o.kind === 'name') lower = o; else if (o.kind === 'loc') loc = o; else if (o.kind === 'title' || o.kind === 'memo') big = o;
    }
    const setCard = (el, o, html) => {
      const key = o ? o.t0 + o.text : '';
      if (el._key !== key) { el._key = key; el.innerHTML = o ? html(o) : ''; }
      if (o) { const a = Math.min((T - o.t0) / 0.8, (o.t1 - T) / 0.8, 1); el.style.opacity = clamp(a); } else el.style.opacity = 0;
    };
    setCard(d.chapter, chap, (o) => `<div class="ch-n">${o.text}</div><div class="ch-s">${o.sub || ''}</div>`);
    setCard(d.lower, lower, (o) => `<div class="lt-n" style="color:${o.color || '#ffd24a'}">${o.text}</div><div class="lt-s">${o.sub || ''}</div>`);
    setCard(d.loc, loc, (o) => `<span>${o.text}</span>`);
    setCard(d.title, big, (o) => `<div class="ti-n${o.kind === 'memo' ? ' sm' : ''}">${o.text}</div><div class="ti-s">${o.sub || ''}</div>`);
    // subtitles
    let line = null;
    for (const s of this.subs) if (T >= s.t0 && T <= s.t1) { line = s; }
    if (this.holdLine && (!line || line === this.holdLine || T >= this.holdLine.t1)) line = this.holdLine;
    const sk = line ? line.t0 + line.text : '';
    if (this._renderedSub !== sk) {
      this._renderedSub = sk;
      d.sub.innerHTML = line ? `<span class="who" style="color:${line.color || '#ffd24a'}">${line.who ? line.who + ':' : ''}</span> <span class="tx">${line.text}</span>` : '';
      d.sub.style.display = (line && this.captions !== false) ? 'block' : 'none';
    }
    // hud time
    if (d.time) { const s = this._fmt(T) + ' / ' + this._fmt(this.total); if (d.time._v !== s) { d.time._v = s; d.time.textContent = s; } }
    if (d.seek && !this._scrubbing) d.seek.value = (T / this.total) * 1000;
    // hour clock
    if (d.clock) {
      const c = this.clockAt ? this.clockAt(T) : null;
      const s = c || '';
      if (d.clock._v !== s) { d.clock._v = s; d.clock.textContent = s; d.clock.style.opacity = s ? 1 : 0; }
    }
  }
  _set(el, key, val, fn) { if (el._v !== val) { el._v = val; fn(); } }
  _fmt(t) { t = Math.max(0, t | 0); return (t / 60 | 0) + ':' + String(t % 60).padStart(2, '0'); }

  play() { this.playing = true; this._lastTs = performance.now(); this.audio && this.audio.setPlaying(true); this.speech.resume(); this.dom.root.classList.add('playing'); }
  pause() { this.playing = false; this.audio && this.audio.setPlaying(false); this.speech.pause(); this.dom.root.classList.remove('playing'); }
  toggle() { this.playing ? this.pause() : this.play(); }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (document.hidden) { this._lastTs = now; if (this.playing) { this._autoPaused = true; this.pause(); } return; }
      if (this._autoPaused) { this._autoPaused = false; this.play(); }
      const dt = Math.max(0, Math.min(0.25, (now - this._lastTs) / 1000)); this._lastTs = now;
      if (this.playing) {
        this.T += dt * this.speech.timeScale(this.T, dt);
        if (this.T >= this.total) { this.T = this.total - 0.001; this.pause(); this.onEnd && this.onEnd(); }
      }
      this.speech.update(this.T, this.playing);
      if (this.audio) { const sk = this.speech.enabled && !!this.speech.speakingKey; if (sk !== this._duck) { this._duck = sk; this.audio.duck(sk); } }
      this.talkKeys = this.speech.enabled ? (this.speech.speakingKey ? [this.speech.speakingKey] : []) : this.subs.filter((s) => this.T >= s.t0 && this.T <= s.t1).map((s) => s.key);
      const minInt = 1000 / this.quality.fps - 4;
      if (!this.playing && !this._dirty) return;
      if (now - this._lastRender < minInt && !this._dirty) return;
      const interval = now - this._lastRender; this._lastRender = now; this._dirty = false;
      if (this.playing) this._adapt(interval);
      this.frame(this.T);
      if (this.audio) this.audio.sync(this.T, this.playing);
    };
    requestAnimationFrame(loop);
  }
  _adapt(interval) {
    if (!this.quality.adaptive) return;
    this._intervals.push(interval);
    if (this._intervals.length >= 75) {
      const avg = this._intervals.reduce((a, b) => a + b, 0) / this._intervals.length;
      this._intervals.length = 0;
      const target = 1000 / this.quality.fps;
      if (avg > target * 1.35 && this.scale > 0.5) { this.scale = Math.max(0.5, this.scale * 0.85); this.applyScale(); }
    }
  }
  dirty() { this._dirty = true; }
}
