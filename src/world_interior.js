import * as THREE from 'three';
import { World } from './film.js';
import { FX, Sky, glowSprite, FlashLights, BeamPool, Tracers } from './fx.js';
import { M, box, sph, cyl, mesh, Human, CHAR, P, makeHeadcrab, animHeadcrab, buildCityGeometry, voughtTex } from './models.js';
import { Screen, CrabSwarm } from './parts.js';
import { concreteTex, asphaltTex, textCanvasTex, windowTextures } from './textures.js';
import { rng, clamp, lerp, smooth, TAU, hash } from './util.js';

class Interior extends World {
  constructor(film, name) {
    super(film, name);
    this.actors = {};
    this.T = 0;
  }
  add(name, human) { human.group.visible = false; this.group.add(human.group); this.actors[name] = human; return human; }
  put(name, x, y, z, ry, pose, o = {}) {
    const a = this.actors[name]; a.group.visible = true; a.place(x, y, z, ry); a.pose(pose);
    if (a.capeMesh) a.updateCape(this.T, o.flow ?? 0, o.wind ?? 1);
    if (o.smile != null) a.face(o.smile); a.heat(!!o.heat);
    return a;
  }
  hideActors() { for (const k in this.actors) this.actors[k].group.visible = false; }
  fillFollow(light, k = 1) {
    const c = this.film.camera; const d = new THREE.Vector3(); c.getWorldDirection(d);
    light.position.copy(c.position).addScaledVector(d, -1.5).add(new THREE.Vector3(1.5, 2, 0)); light.target.position.copy(c.position).addScaledVector(d, 10);
  }
}

/* helpers */
const wallMat = (c, rep = 6) => { const t = concreteTex().clone(); t.repeat.set(rep, rep * 0.4); t.needsUpdate = true; return M.lam(c, { map: t }); };
function chair(c = 0x1c1c22) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.08, 0.5, M.std(c, { roughness: 0.5 }), [0, 0.5, 0]));
  g.add(box(0.5, 0.6, 0.07, M.std(c, { roughness: 0.5 }), [0, 0.85, -0.23]));
  g.add(cyl(0.04, 0.04, 0.5, M.std(0x555555, { metalness: 0.8 }), [0, 0.25, 0], 6));
  g.add(cyl(0.25, 0.25, 0.04, M.std(0x333333), [0, 0.02, 0], 8));
  return g;
}

/* ============================ BOARDROOM ============================ */
export class BoardWorld extends Interior {
  constructor(film) {
    super(film, 'board');
    this.bg = 0x0a0c14; this.fogDensity = 0.0;
    const g = this.group;
    this.sky = new Sky(1800); g.add(this.sky.mesh);
    this.sky.mood({ hor: 0xe0884a, zen: 0x20305a, glow: 0xffa060, glowAmt: 0.6, glowDir: [1, 0.08, -0.3], cloud: 0.9, bright: 1.0, stars: 0 });
    // outside skyline
    const r = rng(77); const blocks = [];
    for (let i = 0; i < 90; i++) { const a = -0.9 + r() * 1.8 + Math.PI * 1.5 - 0.0, d = 60 + r() * 600; blocks.push({ x: Math.cos(a) * d * 1.2 - 0, z: -20 - r() * 520, w: 30 + r() * 40, d: 30 + r() * 40, h: 60 + Math.pow(r(), 1.6) * 330, shade: 0.7 + r() * 0.4 }); }
    for (let i = 0; i < 90; i++) blocks[i].x = (r() - 0.5) * 1100;
    this.city = buildCityGeometry({ seed: 12, blocks, lit: 0.55, warm: 0.65, tint: 0x8a8e9a }); this.city.position.y = -230; g.add(this.city);
    const W = 26, D = 14, H = 4.4;
    const floorM = M.std(0x15161c, { roughness: 0.25, metalness: 0.6 });
    const fl = box(W, 0.2, D, floorM, [0, -0.1, 0]); g.add(fl);
    g.add(box(W, 0.2, D, M.std(0x0f1016), [0, H + 0.1, 0]));
    // walls: back (south), east, west; north = windows
    g.add(box(W, H, 0.3, wallMat(0x2a2c36), [0, H / 2, D / 2]));
    g.add(box(0.3, H, D, wallMat(0x2a2c36), [-W / 2, H / 2, 0]));
    g.add(box(0.3, H, D, wallMat(0x2a2c36), [W / 2, H / 2, 0]));
    // window frames
    const frame = M.std(0x0c0d12, { metalness: 0.7, roughness: 0.4 });
    for (let i = -6; i <= 6; i++) g.add(box(0.18, H, 0.22, frame, [i * 2.0, H / 2, -D / 2]));
    g.add(box(W, 0.2, 0.3, frame, [0, H, -D / 2])); g.add(box(W, 0.25, 0.3, frame, [0, 0.05, -D / 2]));
    // table
    const top = M.std(0x120f0d, { roughness: 0.18, metalness: 0.35 });
    g.add(box(11, 0.12, 2.8, top, [0, 0.76, 0]));
    g.add(box(2, 0.7, 1.4, M.std(0x08080a), [-3.2, 0.38, 0])); g.add(box(2, 0.7, 1.4, M.std(0x08080a), [3.2, 0.38, 0]));
    g.add(box(10.6, 0.02, 0.2, M.emi(0x6fb6ff, { transparent: true, opacity: 0.35 }), [0, 0.835, 0]));
    // chairs
    this.chairs = [];
    const pos = [[-3.6, 1.9, Math.PI], [-1.2, 1.9, Math.PI], [1.2, 1.9, Math.PI], [3.6, 1.9, Math.PI], [-3.6, -1.9, 0], [-1.2, -1.9, 0], [1.2, -1.9, 0], [3.6, -1.9, 0]];
    pos.forEach(([x, z, ry]) => { const c = chair(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); });
    // vought logo wall + screen
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), new THREE.MeshBasicMaterial({ map: voughtTex(), transparent: true })); sign.position.set(0, 2.6, D / 2 - 0.18); sign.rotation.y = Math.PI; g.add(sign);
    this.tv = new Screen(512, 256, (g2, w, h, T) => {
      g2.fillStyle = '#05080c'; g2.fillRect(0, 0, w, h);
      const k = T * 3;
      g2.fillStyle = '#10202c'; g2.fillRect(0, 40, w, h - 80);
      // silhouette skyline w/ glow
      g2.fillStyle = '#17394a';
      for (let i = 0; i < 18; i++) { const bh = 30 + hash(i * 3.3) * 80; g2.fillRect(i * 30, h - 44 - bh, 24, bh); }
      const gr = g2.createRadialGradient(260, 60, 0, 260, 60, 160); gr.addColorStop(0, 'rgba(180,240,255,0.95)'); gr.addColorStop(1, 'rgba(60,160,220,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      for (let i = 0; i < 100; i++) { g2.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(k)) * 0.07})`; g2.fillRect(hash(i * 1.7 + Math.floor(k)) * w, hash(i * 2.9 + Math.floor(k * 0.5)) * h, 28, 1); }
      g2.fillStyle = '#c4161c'; g2.fillRect(0, h - 44, w, 44);
      g2.fillStyle = '#fff'; g2.font = 'bold 22px Arial'; g2.fillText('BREAKING', 14, h - 14); g2.font = '19px Arial';
      g2.fillText('LAS VEGAS — CONTACT LOST · UNKNOWN CRAFT OVER NEVADA', 130, h - 14);
      g2.fillStyle = '#e8d24a'; g2.fillRect(0, 0, w, 36); g2.fillStyle = '#000'; g2.font = 'bold 18px Arial'; g2.fillText('LIVE   AERIAL FEED   NEVADA  15:12 PST', 12, 25);
    });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6), new THREE.MeshBasicMaterial({ map: this.tv.tex })); scr.position.set(-W / 2 + 0.2, 2.3, 0); scr.rotation.y = Math.PI / 2; g.add(scr);
    g.add(box(0.12, 3.8, 7.4, M.std(0x08080a), [-W / 2 + 0.14, 2.3, 0]));
    // lights
    this.hemi = new THREE.HemisphereLight(0xffd6a8, 0x1a1214, 0.9); g.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xff9a5a, 3.2); this.sun.position.set(2, 3, -30); this.sun.target.position.set(0, 1, 0); g.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight(0xffe4c8, 0.9); g.add(this.fill, this.fill.target);
    this.lamp1 = new THREE.PointLight(0xffd8a8, 40, 18, 1.6); this.lamp1.position.set(-4, 3.9, 0); this.lamp2 = new THREE.PointLight(0xffd8a8, 40, 18, 1.6); this.lamp2.position.set(4, 3.9, 0);
    g.add(this.lamp1, this.lamp2);
    for (let i = -2; i <= 2; i++) g.add(box(2.8, 0.05, 0.4, M.emi(0xfff0d8), [i * 4.5, H - 0.05, 0]));
    // actors
    ['homelander', 'starlight', 'maeve', 'atrain', 'deep', 'noir', 'soldierboy', 'edgar', 'ashley'].forEach((n) => this.add(n, CHAR[n]()));
    this.chairsY = 0;
  }
  update(T) {
    this.T = T; this.sky.update(T); this.tv.update(T, 0.2); this.hideActors();
    this.fillFollow(this.fill);
    this.hemi.intensity = 0.8 + 0.1 * Math.sin(T * 0.3);
  }
}

/* ============================ SITUATION ROOM ============================ */
export class SitWorld extends Interior {
  constructor(film) {
    super(film, 'sit');
    this.bg = 0x05070a; this.fogDensity = 0.0;
    const g = this.group;
    const R = 11, H = 5;
    const wm = M.std(0x1a1f26, { roughness: 0.7, metalness: 0.2, side: THREE.BackSide });
    g.add(mesh(new THREE.CylinderGeometry(R, R, H, 14, 1, true), wm, [0, H / 2, 0]));
    g.add(mesh(new THREE.CircleGeometry(R, 14).rotateX(-Math.PI / 2), M.std(0x101318, { roughness: 0.35, metalness: 0.5 }), [0, 0, 0]));
    g.add(mesh(new THREE.CircleGeometry(R, 14).rotateX(Math.PI / 2), M.std(0x0d0f13), [0, H, 0]));
    // ceiling ring lights
    const ringL = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.1, 6, 40).rotateX(Math.PI / 2), M.emi(0xcfe6ff)); ringL.position.y = H - 0.1; g.add(ringL);
    const ringL2 = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.07, 6, 40).rotateX(Math.PI / 2), M.emi(0x6fb6ff)); ringL2.position.y = H - 0.1; g.add(ringL2);
    // table
    g.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.14, 28), M.std(0x0b0d12, { roughness: 0.25, metalness: 0.6 }), [0, 0.78, 0]));
    g.add(cyl(1.2, 1.5, 0.78, M.std(0x08090c), [0, 0.39, 0], 12));
    // holo map
    this.holo = new Screen(512, 512, (c, w, h, T) => {
      c.fillStyle = '#031018'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(80,200,255,0.5)'; c.lineWidth = 1;
      for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
      c.strokeStyle = 'rgba(120,230,255,0.9)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(60, 400); c.bezierCurveTo(120, 300, 140, 200, 180, 60); c.stroke(); c.beginPath(); c.moveTo(150, 460); c.bezierCurveTo(220, 380, 240, 240, 250, 40); c.stroke();
      c.fillStyle = 'rgba(80,200,255,0.18)'; for (let i = 0; i < 40; i++) c.fillRect(hash(i) * 480, hash(i * 1.9) * 480, 14 + hash(i * 3) * 26, 14 + hash(i * 5) * 26);
      const p = 0.5 + 0.5 * Math.sin(T * 6);
      for (let i = 0; i < 9; i++) { const x = 120 + i * 38 + hash(i * 8.3) * 20, y = 90 + hash(i * 4.1) * 60 + (T % 20) * i * 0.2; c.fillStyle = `rgba(255,${40 + p * 40},40,0.95)`; c.beginPath(); c.arc(x, y, 7 + p * 3, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,80,60,0.6)'; c.beginPath(); c.arc(x, y, 18 + p * 8, 0, TAU); c.stroke(); }
      c.fillStyle = '#7fe8ff'; c.font = 'bold 22px monospace'; c.fillText('MANHATTAN  ·  HOSTILE CONTACTS: ' + (9 + Math.floor(T % 7)), 20, 34);
    });
    const hm = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.holo.tex, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); hm.position.y = 0.88; g.add(hm);
    // wall screens
    this.main = new Screen(768, 320, (c, w, h, T) => {
      const mode = this.screenMode || 0;
      c.fillStyle = mode === 1 ? '#03070a' : '#06090d'; c.fillRect(0, 0, w, h);
      if (mode === 1) { // Combine broadcast glyph
        const p = 0.5 + 0.5 * Math.sin(T * 3);
        c.strokeStyle = `rgba(120,220,255,${0.6 + p * 0.4})`; c.lineWidth = 7;
        c.beginPath(); c.arc(w / 2, h / 2, 90, 0, TAU); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 56 + p * 6, 0, TAU); c.stroke();
        c.beginPath(); c.moveTo(w / 2, h / 2 - 130); c.lineTo(w / 2, h / 2 + 130); c.moveTo(w / 2 - 130, h / 2); c.lineTo(w / 2 + 130, h / 2); c.stroke();
        for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(140,220,255,${hash(i + Math.floor(T * 8)) * 0.12})`; c.fillRect(0, hash(i * 3.7 + Math.floor(T * 8)) * h, w, 2); }
        c.fillStyle = '#7fe8ff'; c.font = 'bold 20px monospace'; c.fillText('UNIVERSAL UNION — ADMINISTRATIVE BROADCAST', 18, 30);
      } else {
        c.fillStyle = '#c4161c'; c.fillRect(0, 0, w, 40); c.fillStyle = '#fff'; c.font = 'bold 24px Arial'; c.fillText('NATIONAL ALERT — NEW YORK CITY', 16, 28);
        c.fillStyle = '#10202c'; c.fillRect(20, 60, w - 40, h - 80);
        for (let i = 0; i < 13; i++) { c.fillStyle = '#1d4258'; c.fillRect(30 + i * 56, 240 - hash(i * 4.1) * 120, 38, 120 + hash(i * 4.1) * 40); }
        c.fillStyle = '#ff5a3a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(80 + i * 110, 150 + hash(i + Math.floor(T)) * 40, 7, 0, TAU); c.fill(); }
      }
    });
    this.mainM = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.2), new THREE.MeshBasicMaterial({ map: this.main.tex })); this.mainM.position.set(0, 2.8, -R + 0.35); g.add(this.mainM);
    g.add(box(10.3, 4.5, 0.2, M.std(0x07080a), [0, 2.8, -R + 0.22]));
    for (const sx of [-1, 1]) { const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshBasicMaterial({ map: this.holo.tex })); const a = sx * 0.9; s2.position.set(Math.sin(a) * (R - 0.4), 2.7, -Math.cos(a) * (R - 0.4)); s2.lookAt(0, 2.7, 0); g.add(s2); }
    // flags
    const flag = textCanvasTex(256, 160, (c, w, h) => { c.fillStyle = '#b22234'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; for (let i = 1; i < 13; i += 2) c.fillRect(0, i * h / 13, w, h / 13); c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.42, h * 7 / 13); c.fillStyle = '#fff'; for (let i = 0; i < 40; i++) c.fillRect(8 + (i % 8) * 13, 8 + Math.floor(i / 8) * 13, 3, 3); });
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: flag, side: THREE.DoubleSide })); f.position.set(sx * 6.4, 3.0, -R + 2.2 - 0.6); f.rotation.y = -sx * 0.25; g.add(f); g.add(cyl(0.04, 0.04, 4.6, M.std(0x886622), [sx * 7.5, 2.3, -R + 1.8], 5)); }
    // chairs
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.31; const c = chair(0x1d2026); c.position.set(Math.cos(a) * 4.5, 0, Math.sin(a) * 4.5); c.rotation.y = -a - Math.PI / 2; g.add(c); }
    this.hemi = new THREE.HemisphereLight(0x9fc0e0, 0x1c2026, 1.1); g.add(this.hemi);
    this.l1 = new THREE.PointLight(0xcfe6ff, 140, 30, 1.4); this.l1.position.set(0, 4.5, 0); g.add(this.l1);
    this.alarm = new THREE.PointLight(0xff2a1a, 0, 22, 1.5); this.alarm.position.set(0, 4.6, 3); g.add(this.alarm);
    this.fill = new THREE.DirectionalLight(0xcfe4ff, 1.4); g.add(this.fill, this.fill.target);
    ['general', 'neuman', 'edgar', 'ashley', 'homelander', 'soldierboy'].forEach((n) => this.add(n, CHAR[n]()));
    for (let i = 0; i < 4; i++) this.add('staff' + i, CHAR.civilian(i + 20));
  }
  update(T) {
    this.T = T; if (this.screenMode !== this._m) { this._m = this.screenMode; this.main.last = -1; } this.holo.update(T, 0.2); this.main.update(T, 0.12); this.hideActors(); this.fillFollow(this.fill);
    this.alarm.intensity = (this.alarmOn ?? 0) * (30 + 30 * Math.sin(T * 7));
    this.mainM.material.map = this.main.tex;
  }
}

/* ============================ HIDEOUT ============================ */
export class HideWorld extends Interior {
  constructor(film) {
    super(film, 'hide');
    this.bg = 0x07080a; this.fogDensity = 0.012; this.fogColor = 0x0a0b0d;
    const g = this.group;
    const W = 12, D = 9, H = 3.6;
    const brick = textCanvasTex(256, 256, (c, w, h) => { c.fillStyle = '#4a2c24'; c.fillRect(0, 0, w, h); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const v = 60 + hash(x * 7 + y * 13) * 40; c.fillStyle = `rgb(${v + 30},${v * 0.6},${v * 0.5})`; c.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 29, 13); } }, { repeat: true });
    brick.repeat.set(3, 1);
    const bm = M.lam(0xffffff, { map: brick });
    g.add(box(W, 0.2, D, M.lam(0x2a2a2c, { map: asphaltTex() }), [0, -0.1, 0]));
    g.add(box(W, H, 0.3, bm, [0, H / 2, -D / 2])); g.add(box(0.3, H, D, bm, [-W / 2, H / 2, 0])); g.add(box(0.3, H, D, bm, [W / 2, H / 2, 0])); g.add(box(W, H, 0.3, bm, [0, H / 2, D / 2]));
    g.add(box(W, 0.2, D, M.lam(0x1a1a1c), [0, H + 0.1, 0]));
    g.add(box(W, 0.25, 0.3, M.std(0x222226), [0, H - 0.2, -D / 2 + 0.2]));
    // table with monitors
    g.add(box(4.4, 0.1, 1.5, M.std(0x4a3a2a, { roughness: 0.8 }), [0, 0.78, -1.2]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, 0.78, 0.1, M.std(0x222222), [sx * 2.1, 0.39, -1.2 + sz * 0.65]));
    this.tv = new Screen(256, 160, (c, w, h, T) => {
      c.fillStyle = '#06090d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#17394a'; for (let i = 0; i < 12; i++) c.fillRect(i * 22, h - 30 - hash(i * 3.3) * 70, 17, 90);
      const gr = c.createRadialGradient(130, 40, 0, 130, 40, 100); gr.addColorStop(0, 'rgba(180,240,255,.95)'); gr.addColorStop(1, 'rgba(60,160,220,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c4161c'; c.fillRect(0, h - 22, w, 22); c.fillStyle = '#fff'; c.font = 'bold 14px Arial'; c.fillText('LIVE · NEVADA · CONTACT LOST', 8, h - 6);
      for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(T * 6)) * 0.08})`; c.fillRect(0, hash(i * 5.1 + Math.floor(T * 6)) * h, w, 1); }
    });
    for (const [x, ry] of [[-1.2, 0.2], [0.2, 0], [1.5, -0.25]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ map: this.tv.tex })); m.position.set(x, 1.35, -1.55); m.rotation.y = ry; g.add(m); g.add(box(1.16, 0.76, 0.06, M.std(0x111111), [x, 1.35, -1.6]).rotateY(ry)); }
    // shelves, crates, couch
    for (let i = 0; i < 4; i++) g.add(box(1.2, 0.8, 0.9, M.std(0x3a4430, { roughness: 0.9 }), [-5 + i * 1.3, 0.4 + (i % 2) * 0.8, -3.7]));
    g.add(box(2.4, 0.5, 0.9, M.std(0x3a2a22, { roughness: 1 }), [3.8, 0.28, 2.6])); g.add(box(2.4, 0.7, 0.2, M.std(0x3a2a22, { roughness: 1 }), [3.8, 0.7, 3.0]));
    const map = textCanvasTex(256, 160, (c, w, h) => { c.fillStyle = '#c8bfa0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#6a6a6a'; for (let i = 0; i < 12; i++) { c.beginPath(); c.moveTo(hash(i) * w, 0); c.lineTo(hash(i + 3) * w, h); c.stroke(); } c.fillStyle = '#b01818'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(40 + hash(i * 2.2) * 170, 30 + hash(i * 5.1) * 100, 5, 0, TAU); c.fill(); } });
    const mp = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshLambertMaterial({ map })); mp.position.set(-3.5, 1.9, -D / 2 + 0.2); g.add(mp);
    // bulb
    this.bulb = new THREE.PointLight(0xffc886, 28, 16, 1.5); this.bulb.position.set(0, 3.0, 0); g.add(this.bulb);
    g.add(cyl(0.01, 0.01, 0.6, M.std(0x111111), [0, 3.3, 0], 3)); g.add(sph(0.1, M.emi(0xffe0a8), [0, 3.0, 0]));
    this.glowB = glowSprite(0xffc886, 2.4, 0.9); this.glowB.position.set(0, 3.0, 0); g.add(this.glowB);
    this.hemi = new THREE.HemisphereLight(0x6a7a90, 0x201410, 0.45); g.add(this.hemi);
    this.tvl = new THREE.PointLight(0x8ad8ff, 9, 10, 1.6); this.tvl.position.set(0, 1.5, -0.6); g.add(this.tvl);
    this.fill = new THREE.DirectionalLight(0xffe0c0, 0.75); g.add(this.fill, this.fill.target);
    ['butcher', 'hughie', 'mm', 'frenchie', 'kimiko'].forEach((n) => this.add(n, CHAR[n]()));
  }
  update(T) {
    this.T = T; this.tv.update(T, 0.15); this.hideActors(); this.fillFollow(this.fill);
    const f = 0.88 + 0.12 * Math.sin(T * 17) * Math.sin(T * 5.3);
    this.bulb.intensity = 28 * f; this.glowB.material.opacity = 0.7 * f + 0.2; this.tvl.intensity = 8 + 3 * Math.sin(T * 9);
  }
}

/* ============================ CORRIDOR ============================ */
export class CorrWorld extends Interior {
  constructor(film) {
    super(film, 'corr');
    this.bg = 0x040506; this.fogDensity = 0.045; this.fogColor = 0x14181a;
    const g = this.group; this.fx = new FX();
    this.tracers = new Tracers(80); g.add(this.tracers.mesh);
    const L = 70, Wd = 3.6, H = 3.2;
    const wl = wallMat(0x7a8088, 14);
    for (const sx of [-1, 1]) { g.add(box(0.3, H, L, wl, [sx * Wd / 2, H / 2, -L / 2 + 6])); }
    g.add(box(Wd + 0.6, 0.2, L, M.std(0x15181b, { roughness: 0.4, metalness: 0.6 }), [0, -0.1, -L / 2 + 6]));
    g.add(box(Wd + 0.6, 0.2, L, M.lam(0x1c1f22), [0, H + 0.1, -L / 2 + 6]));
    for (let z = 4; z > -L + 6; z -= 3.5) for (const sx of [-1, 1]) g.add(box(0.12, H, 0.14, M.std(0x2a2e33, { metalness: 0.6 }), [sx * (Wd / 2 - 0.1), H / 2, z]));
    // ceiling pipes
    for (const x of [-1.2, -0.7, 1.1]) { const p = cyl(0.09, 0.09, L, M.std(0x4a4f52, { metalness: 0.7 }), [x, H - 0.2, -L / 2 + 6], 6); p.rotation.x = Math.PI / 2; g.add(p); }
    // lights
    this.lights = [];
    for (let i = 0; i < 12; i++) {
      const z = 2 - i * 5.2;
      const fix = box(0.5, 0.06, 1.6, M.emi(0xfff6e0), [0, H - 0.05, z]); g.add(fix);
      const gl = glowSprite(0xfff0d0, 5, 0.7); gl.position.set(0, H - 0.3, z); g.add(gl);
      this.lights.push({ fix, gl, z });
    }
    this.pl = [new THREE.PointLight(0xfff0d8, 22, 16, 1.7), new THREE.PointLight(0xfff0d8, 22, 16, 1.7)]; this.pl.forEach((l) => g.add(l));
    this.hemi = new THREE.HemisphereLight(0x8a9aa8, 0x1a1c1e, 0.4); g.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0xdde8f0, 0.7); g.add(this.fill, this.fill.target);
    // end door
    const door = box(Wd - 0.2, H - 0.3, 0.3, M.std(0x4a4f52, { metalness: 0.6, roughness: 0.5 }), [0, H / 2 - 0.15, -L + 8]); g.add(door);
    for (let i = 0; i < 6; i++) g.add(box(0.5, 0.25, 0.32, M.std(0xd9b82a), [-1.3 + i * 0.5, 0.4, -L + 8]).rotateZ(0.7));
    this.door = door;
    // mist
    this.mist = []; const r = rng(3);
    for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexLike(), color: 0x8a9298, transparent: true, opacity: 0.1, depthWrite: false, fog: false })); s.scale.set(5, 3.5, 1); s.position.set((r() - 0.5) * 2, 0.9 + r() * 1.4, 4 - r() * 52); g.add(s); this.mist.push({ s, ph: r() * 6, z: s.position.z }); }
    // crabs: scripted
    this.crabList = [];
    const rr = rng(33);
    for (let i = 0; i < 26; i++) {
      const c = makeHeadcrab(1.25); c.visible = false; g.add(c);
      this.crabList.push({ g: c, t0: 358 + rr() * 12 + i * 0.35, z0: -42 + rr() * 6, x: (rr() - 0.5) * 2.6, v: 4 + rr() * 3, wall: rr() < 0.3 ? (rr() < 0.5 ? 1 : -1) : 0, ph: rr() * 6, hop: 0.45 + rr() * 0.3 });
    }
    ['butcher', 'hughie', 'mm', 'frenchie', 'kimiko'].forEach((n) => this.add(n, CHAR[n]()));
    for (let i = 0; i < 3; i++) { const s = CHAR.soldier(i); this.add('sol' + i, s); }
    this.big = [makeHeadcrab(2.5), makeHeadcrab(2.5)]; this.big.forEach((b) => { b.visible = false; g.add(b); });
    this.muzzle = glowSprite(0xffd890, 1.6, 0); g.add(this.muzzle);
    this.torch = new THREE.SpotLight(0xfff4e0, 140, 34, 0.38, 0.6, 1.2); g.add(this.torch, this.torch.target); this.torch.intensity = 0;
    this.blastL = new THREE.PointLight(0xff9a40, 0, 40, 1.4); g.add(this.blastL); this.redL = new THREE.PointLight(0xff3a22, 0, 24, 1.3); this.redL.position.set(0, 2.6, -48); g.add(this.redL);
    for (const k of ['butcher', 'hughie', 'mm', 'frenchie', 'kimiko']) { const h = this.actors[k]; h.gun = h._gun(); h.elR.add(h.gun); }
    this.blastT = 388.4; this.redFrom = 388.4;
    this.fx.explosion(0.5, 1.6, -56, 388.4, 2.2); this.fx.explosion(0.0, 1.2, -50, 388.55, 1.4); this.fx.sparks.add({ x: 0, y: 1, z: -56, vx: 0, vy: 4, vz: 12, t0: 388.4, life: 2, s0: 0.3, s1: 0.1, c0: [1, 0.8, 0.4, 1], c1: [1, 0.3, 0.05, 0] });
    g.add(this.fx.build());
  }
  update(T) {
    this.T = T; this.hideActors(); this.fillFollow(this.fill);
    this.fx.update(T);
    const bu = T - this.blastT; this.blastL.position.set(0, 1.8, -52); this.blastL.intensity = bu > 0 && bu < 3 ? 9000 * Math.exp(-bu * 2.2) : 0;
    const red = T >= this.redFrom && T < 600; this.hemi.color.set(red ? 0xff5a3a : 0x8a9aa8); this.hemi.intensity = red ? 0.9 : 0.4; this.redL.intensity = red ? 140 + 60 * Math.sin(T * 5) : 0;
    // flicker lights
    this.lights.forEach((l, i) => { const f = hash(Math.floor(T * 14) + i * 7.1) > 0.9 - (T > 352 ? 0.12 : 0.05) ? 0.15 : 1; if (T >= this.redFrom) { l.fix.material.color.set(0xff3a22).multiplyScalar(f * (0.5 + 0.5 * Math.sin(T * 5 + i))); l.gl.material.color.set(0xff3a22); } else { l.fix.material.color.set(0xfff6e0).multiplyScalar(f); l.gl.material.color.set(0xfff0d0); } l.gl.material.opacity = 0.7 * f; });
    this.mist.forEach((m) => { m.s.position.x = Math.sin(T * 0.3 + m.ph) * 1.0; m.s.material.opacity = 0.07 + 0.04 * Math.sin(T * 0.5 + m.ph); });
    // crabs
    for (const c of this.crabList) {
      const a = T - c.t0;
      if (a < 0 || a > 40) { c.g.visible = false; continue; }
      c.g.visible = true;
      const z = c.z0 + c.v * a; if (z > 14) { c.g.visible = false; continue; }
      const hop = (a % c.hop) / c.hop;
      let x = c.x + Math.sin(a * 0.9 + c.ph) * 0.6, y = Math.sin(hop * Math.PI) * 0.5;
      c.g.rotation.set(0, 0, 0);
      if (c.wall) { x = c.wall * 1.7; y = 1.0 + Math.sin(a + c.ph) * 0.8; c.g.rotation.z = -c.wall * Math.PI / 2; }
      c.g.position.set(x, y, z); c.g.rotation.y = Math.PI;
      animHeadcrab(c.g, a, 'crawl');
    }
  }
}
let _gt;
function glowTexLike() {
  if (_gt) return _gt;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _gt = new THREE.CanvasTexture(c); return _gt;
}
