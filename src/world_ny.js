import * as THREE from 'three';
import { World } from './film.js';
import { FX, Sky, Vortex, BeamPool, Tracers, FlashLights, glowSprite } from './fx.js';
import { M, box, sph, cyl, mesh, blob, Human, CHAR, P, Strider, Gunship, Dropship, makeJet, makeChinook, makeTank, buildCityGeometry, makeBuilding, makeVoughtTower, makeBanner, animHeadcrab, makeHeadcrab } from './models.js';
import { PodField, CrabSwarm, Crowd, makeCars, makeLamps } from './parts.js';
import { moodAt, Path, sampleTrack, placeFlyer, trackVisible, pick } from './common.js';
import { asphaltTex, concreteTex, roadTex } from './textures.js';
import { rng, clamp, lerp, smooth, TAU, V, hash } from './util.js';

export const STR = 1.6;
export const NY_MOODS = [
  [0, { hor: 0xd0804a, zen: 0x1d2a4a, fogC: 0x6a5058, fogD: 0.0007, hemiS: 0x9ab0d8, hemiG: 0x44323a, hemiI: 1.0, sunC: 0xffa05a, sunI: 3.4, sunDir: [400, 70, -80], win: 0.9, glowAmt: 0, glow: 0x6fd0ff, cloud: 0.9, bright: 1.0, stars: 0 }],
  [130, { hor: 0x7a4a52, zen: 0x101a36, fogC: 0x3a3040, fogD: 0.0008, hemiS: 0x6a80b0, hemiG: 0x2a2030, hemiI: 0.85, sunC: 0xff8a5a, sunI: 1.4, sunDir: [400, 30, -80], win: 1.1, glowAmt: 0, glow: 0x6fd0ff, cloud: 0.9, bright: 0.9, stars: 0.5 }],
  [150, { hor: 0x36525c, zen: 0x0b161e, fogC: 0x1f313a, fogD: 0.0013, hemiS: 0x5a8aa8, hemiG: 0x1c2a30, hemiI: 0.95, sunC: 0x78c8e8, sunI: 1.5, sunDir: [-60, 300, -420], win: 1.2, glowAmt: 0.9, glow: 0x6fd0ff, cloud: 1.1, bright: 1.0, stars: 0 }],
  [232, { hor: 0x2a3a40, zen: 0x070d11, fogC: 0x172228, fogD: 0.0016, hemiS: 0x4a7a98, hemiG: 0x1a1f20, hemiI: 0.8, sunC: 0x5aa8c8, sunI: 1.3, sunDir: [-60, 300, -420], win: 1.3, glowAmt: 1.0, glow: 0x6fd0ff, cloud: 1.1, bright: 1.0, stars: 0 }],
  [400, { hor: 0x4a3228, zen: 0x0a0e12, fogC: 0x261a18, fogD: 0.002, hemiS: 0x4a6a80, hemiG: 0x3a2214, hemiI: 0.8, sunC: 0x6fb8d8, sunI: 1.2, sunDir: [-60, 300, -420], win: 1.2, glowAmt: 1.0, glow: 0x6fd0ff, cloud: 1.2, bright: 1.0, stars: 0 }],
  [512, { hor: 0x4a3a30, zen: 0x0a0e12, fogC: 0x241c1a, fogD: 0.0021, hemiS: 0x4a6a80, hemiG: 0x3a2214, hemiI: 0.8, sunC: 0x6fb8d8, sunI: 1.2, sunDir: [-60, 300, -420], win: 1.2, glowAmt: 1.0, glow: 0x6fd0ff, cloud: 1.2, bright: 1.0, stars: 0 }],
  [530, { hor: 0x5a6a76, zen: 0x121c26, fogC: 0x3a4650, fogD: 0.0014, hemiS: 0x8aa8c0, hemiG: 0x2a2a30, hemiI: 1.0, sunC: 0xa8c8e0, sunI: 1.8, sunDir: [-300, 120, -300], win: 0.7, glowAmt: 0.5, glow: 0x6fd0ff, cloud: 1.0, bright: 1.0, stars: 0 }],
  [600, { hor: 0x5a6a76, zen: 0x121c26, fogC: 0x3a4650, fogD: 0.0014, hemiS: 0x8aa8c0, hemiG: 0x2a2a30, hemiI: 1.0, sunC: 0xa8c8e0, sunI: 1.8, sunDir: [-300, 120, -300], win: 0.7, glowAmt: 0.5, glow: 0x6fd0ff, cloud: 1.0, bright: 1.0, stars: 0 }],
];

// frontage of the avenue (destructible, individually meshed)
export const DESTRUCT = [
  { x: 40, z: -120, w: 40, d: 52, h: 150, t: 219.7, seed: 31 },
  { x: -40, z: -175, w: 42, d: 56, h: 170, t: 414.7, seed: 32 },
  { x: -40, z: -135, w: 40, d: 50, h: 140, t: 296.9, seed: 33 },
  { x: -40, z: -95, w: 38, d: 46, h: 110, t: 458.0, seed: 34 },
  { x: 40, z: -40, w: 40, d: 50, h: 95, t: 474.4, seed: 35 },
];

export class NYWorld extends World {
  constructor(film) {
    super(film, 'ny');
    this.fogDensity = 0.001; this.fogColor = 0x222222;
    const g = this.group;
    this.fx = new FX();
    this.beams = new BeamPool(28); this.tracers = new Tracers(260); this.flashL = new FlashLights(2, 0xff9a50, 140);
    this.hemi = new THREE.HemisphereLight(0x889aa8, 0x2a2020, 1); this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.8); g.add(this.fill, this.fill.target); this.sun = new THREE.DirectionalLight(0xffa060, 3);
    g.add(this.hemi, this.sun, this.sun.target, this.flashL.group);
    this.sky = new Sky(3600); g.add(this.sky.mesh);
    // ground + avenue
    const gt = concreteTex().clone(); gt.repeat.set(220, 220); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), M.lam(0x5a5c62, { map: gt }));
    ground.position.y = -0.05; g.add(ground);
    const rt = roadTex().clone(); rt.repeat.set(1, 40); rt.needsUpdate = true;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 2400).rotateX(-Math.PI / 2), M.lam(0xffffff, { map: rt }));
    road.position.set(0, 0.02, -950); g.add(road);
    // buildings
    const r = rng(42); const blocks = [];
    for (let ix = -8; ix <= 8; ix++) for (let iz = -26; iz <= 2; iz++) {
      const cx = ix * 76 + (r() - 0.5) * 8, cz = iz * 84 + (r() - 0.5) * 10;
      if (Math.abs(cx) < 70) continue;
      if (Math.hypot(cx + 70, cz + 50) < 70) continue;
      const dist = Math.hypot(cx, cz + 250) / 1100;
      const h = (22 + Math.pow(r(), 1.7) * 330) * clamp(1.25 - dist * 0.85, 0.25, 1.2);
      blocks.push({ x: cx, z: cz, w: 30 + r() * 24, d: 34 + r() * 26, h, shade: 0.8 + r() * 0.5 });
    }
    // frontage rows
    for (let iz = -28; iz <= 2; iz++) for (const sx of [-1, 1]) {
      const cx = sx * 42, cz = iz * 84 + 20;
      if (DESTRUCT.some((d) => Math.abs(d.x - cx) < 10 && Math.abs(d.z - cz) < 40)) continue;
      if (Math.hypot(cx + 70, cz + 50) < 56) continue;
      blocks.push({ x: cx, z: cz, w: 38, d: 56 + r() * 10, h: 40 + r() * 170, shade: 0.9 + r() * 0.3 });
    }
    this.city = buildCityGeometry({ seed: 7, blocks, lit: 0.5, warm: 0.65, tint: 0x9aa0aa });
    g.add(this.city);
    // destructibles
    this.destruct = DESTRUCT.map((d) => {
      const m = makeBuilding(d.w, d.d, d.h, 0x9a9ea8, d.seed); m.position.set(d.x, 0, d.z); g.add(m);
      const rub = new THREE.Group(); const rr = rng(d.seed);
      for (let i = 0; i < 10; i++) { const b = box(6 + rr() * 12, 2 + rr() * 6, 6 + rr() * 12, M.lam(0x55565a), [d.x + (rr() - 0.5) * d.w * 0.9, 2, d.z + (rr() - 0.5) * d.d * 0.9]); b.rotation.set(rr() * 0.4, rr() * 3, rr() * 0.4); rub.add(b); }
      rub.visible = false; g.add(rub);
      return { m, d, rub };
    });
    // Vought Tower
    this.tower = makeVoughtTower(); this.tower.position.set(-70, 0, -50); g.add(this.tower);
    const hp = new THREE.Group(); hp.position.set(-70 + 34, 189, -50); g.add(hp);
    hp.add(cyl(11, 11, 1.2, M.std(0x2a2e33, { metalness: 0.4 }), [0, 0, 0], 24));
    for (let i = 0; i < 8; i++) hp.add(box(1, 0.8, 1, M.emi(0xffd24a), [Math.cos(i * TAU / 8) * 10.6, 0.8, Math.sin(i * TAU / 8) * 10.6]));
    const h = new THREE.Mesh(new THREE.RingGeometry(6.8, 7.8, 24).rotateX(-Math.PI / 2), M.emi(0xffd24a)); h.position.y = 0.65; hp.add(h);
    for (const s of [[-8, 0], [8, 0]]) hp.add(cyl(0.3, 0.3, 16, M.std(0x444444), [s[0] * 0.4 - 6, -8, s[1]], 5));
    hp.add(box(18, 1, 2, M.std(0x333333), [-9, -0.3, 0]));
    // props
    makeCars(40, g, { z0: -330, z1: 60, rows: [-8.6, -4.0, 4.0, 8.6], exclude: [[-150, -105], [-40, 5], [-312, -285], [-250, -228]] });
    this.lamps = makeLamps(g, { z0: -400, z1: 80, step: 30, xs: [-13.2, 13.2] });
    this.crowd = new Crowd(110, g, { z0: -90, z1: 90, x0: -11, x1: 11, t0: 0, seed: 3, panicT: 156, fadeStart: 236, fadeT: 330 });
    // vortices
    this.vorts = [
      { v: new Vortex(430), p: [-20, 700, -430], t: 146 },
      { v: new Vortex(360), p: [-340, 780, -160], t: 148 },
      { v: new Vortex(380), p: [270, 830, -610], t: 149 },
      { v: new Vortex(300), p: [80, 900, 90], t: 151 },
    ];
    this.vorts.forEach((o) => { o.v.group.position.set(...o.p); g.add(o.v.group); });
    // portal glow on horizon (for before storm)
    this.horizonGlow = glowSprite(0x8fdcff, 500, 0.0); this.horizonGlow.position.set(-20, 500, -1400); g.add(this.horizonGlow);
    // actors
    this.actors = {};
    for (const k of ['homelander', 'starlight', 'maeve', 'atrain', 'deep', 'noir', 'soldierboy', 'butcher', 'hughie', 'mm', 'kimiko']) { const a = CHAR[k](); a.group.visible = false; g.add(a.group); this.actors[k] = a; }
    this.jumper = makeHeadcrab(1.2); this.jumper.visible = false; g.add(this.jumper);
    this.fcrabs = []; for (let i = 0; i < 6; i++) { const c = makeHeadcrab(1.25); c.visible = false; g.add(c); this.fcrabs.push(c); }
    this.zomb = []; for (let i = 0; i < 6; i++) { const z = CHAR.civilian(i + 40); z.mats.sk.color.set(0x8a9a86); z.group.visible = false; const c = makeHeadcrab(1.1); c.position.set(0, 0.22, 0); z.head.add(c); g.add(z.group); this.zomb.push(z); }
    this.capeFall = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2, 5, 8), M.std(0xa01018, { side: THREE.DoubleSide, roughness: 0.8 })); this.capeFall.visible = false; g.add(this.capeFall);
    this.capeBase = this.capeFall.geometry.attributes.position.array.slice();
    this.dropBeam = new THREE.Mesh(new THREE.CylinderGeometry(14, 22, 1000, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.dropBeam.visible = false; g.add(this.dropBeam);
    this.zdeep = CHAR.deep(); this.zdeep.group.visible = false; g.add(this.zdeep.group);
    this.zcrab = makeHeadcrab(1.1); this.zdeep.head.add(this.zcrab); this.zcrab.position.set(0, 0.2, 0); this.zcrab.rotation.x = 0.0;
    this.zdeep.mats.sk.color.set(0x8a9a86); this.zdeep.mats.suit.color.multiplyScalar(0.6);
    this.soldiers = []; for (let i = 0; i < 14; i++) { const s = CHAR.soldier(i); s.group.visible = false; g.add(s.group); this.soldiers.push(s); }
    this.civs = []; for (let i = 0; i < 6; i++) { const s = CHAR.civilian(i + 1); s.group.visible = false; g.add(s.group); this.civs.push(s); }
    this.hero = new THREE.Group(); g.add(this.hero);
    this.capeHold = box(0.55, 0.1, 0.42, M.std(0xa01018, { roughness: 0.8 }), [0, -0.3, 0.12]); this.actors.starlight.elL.add(this.capeHold); this.capeHold.visible = false;
    this.lighter = glowSprite(0xffb050, 0.55, 0); this.lighter.position.set(0, -0.32, 0.08); this.actors.kimiko.elR.add(this.lighter);
    // striders
    this.S = []; this.Spath = [];
    for (let i = 0; i < 6; i++) { const s = new Strider(); s.g.scale.setScalar(STR); s.g.visible = false; g.add(s.g); this.S.push(s); }
    this.sFire = []; this.sAim = []; this.sDrop = []; this.sDead = [];
    // gunships / dropships / jets
    this.gun = []; this.gunTrack = [];
    for (let i = 0; i < 8; i++) { const s = new Gunship(); s.g.visible = false; g.add(s.g); this.gun.push(s); this.gunTrack.push([]); }
    this.gunFireWin = [];
    this.drop = []; this.dropTrack = [];
    for (let i = 0; i < 3; i++) { const s = new Dropship(); s.g.visible = false; g.add(s.g); this.drop.push(s); this.dropTrack.push([]); }
    this.jets = []; this.jetTrack = [];
    for (let i = 0; i < 6; i++) { const j = makeJet([0x6b747b, 0x59626a, 0x7a8288][i % 3]); j.visible = false; g.add(j); this.jets.push(j); this.jetTrack.push([]); }
    this.jetDead = [];
    this.tanks = []; for (let i = 0; i < 7; i++) { const t = makeTank(); t.visible = false; g.add(t); this.tanks.push(t); }
    this.tankFire = []; this.tankDead = [];
    // pods + crabs (event lists populated by script)
    const pods = []; const pr = rng(91);
    for (let i = 0; i < 26; i++) pods.push({ x: (pr() - 0.5) * 70 + (pr() < 0.5 ? -1 : 1) * 4, z: -170 + pr() * 230, t: 158 + pr() * 14 + (i % 5) * 0.4, s: 1.4 + pr() * 0.5, fx: 60 + pr() * 90, fz: -50 - pr() * 80 });
    pods.sort((a, b) => a.t - b.t);
    // a couple pods with controlled positions for key shots
    this.podData = pods;
    this.pods = new PodField(pods, { parent: g, fx: this.fx });
    this.crabs = new CrabSwarm(pods, g, 2, 5, 0, -40);
    // Citadel
    this.citadel = new THREE.Group(); g.add(this.citadel); this._buildCitadel();
    // banners
    this.banners = []; for (let i = 0; i < 6; i++) { const b = makeBanner(); b.visible = false; g.add(b); this.banners.push(b); }
    g.add(this.beams.group, this.tracers.mesh);
    this.dropBeams = [];
    this.mood = moodAt(NY_MOODS, 0);
    this.T = 0;
  }
  _buildCitadel() {
    const g = this.citadel, dark = M.std(0x14181c, { metalness: 0.7, roughness: 0.4 }), mid = M.std(0x232a30, { metalness: 0.6, roughness: 0.5 });
    const glow = M.emi(0x7fd8ff);
    g.add(cyl(40, 70, 220, dark, [0, 110, 0], 8));
    g.add(cyl(26, 40, 160, mid, [0, 300, 0], 8));
    g.add(cyl(14, 26, 150, dark, [0, 455, 0], 8));
    g.add(cyl(4, 14, 140, mid, [0, 600, 0], 6));
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(30 - i * 4, 1.5, 4, 16).rotateX(Math.PI / 2), glow); t.position.y = 90 + i * 130; g.add(t); }
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; const sp = cyl(5, 10, 280, dark, [Math.cos(a) * 85, 140, Math.sin(a) * 85], 6); sp.rotation.set(Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12); g.add(sp); }
    this.citCore = glowSprite(0x9fe6ff, 260, 1); this.citCore.position.set(0, 690, 0); g.add(this.citCore);
    this.citBeam = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 900, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.citBeam.position.y = 1100; g.add(this.citBeam);
    g.position.set(40, 0, -800); g.visible = false;
  }

  // ---------- authoring helpers ----------
  boom(t, x, y, z, s = 1, opt = {}) {
    this.fx.explosion(x, y, z, t, s, opt);
    this.flashL.add(x, y + 2, z, t, 0.55 + 0.1 * s, 2400 * s, opt.blue ? 0x8fd8ff : 0xffa050);
    this.film.cue(t, 'explosion', { s }, 'ny');
  }
  burn(x, y, z, t0, t1, s = 1) { this.fx.burn(x, y, z, t0, t1, s); }
  striderFire(i, t, tgt, opt = {}) { (this.pendFire = this.pendFire || []).push({ i, t, tgt, opt }); }
  _commitFire({ i, t, tgt, opt }) {
    const p = this.Spath[i].at(t);
    const yaw = p.yaw + (opt.aimYaw || 0);
    const dx = tgt[0] - p.x, dz = tgt[2] - p.z; const ay = Math.atan2(dx, dz);
    const mz = { x: p.x + Math.sin(ay) * 5.2 * STR, y: 11.0 * STR, z: p.z + Math.cos(ay) * 5.2 * STR };
    this.sFire.push({ i, t, tgt });
    this.sAim.push({ i, t0: t - 1.0, t1: t + 0.9, tgt });
    this.beams.add({ a: [mz.x, mz.y, mz.z], b: tgt, t0: t, dur: 0.22, travel: 0.5, w: 0.9 * (opt.w || 1), color: 0xa8e8ff });
    this.beams.add({ a: [mz.x, mz.y, mz.z], b: tgt, t0: t, dur: 0.5, w: 0.25, color: 0xffffff, opacity: 0.5 });
    this.film.cue(t, 'strider_fire', {}, 'ny');
    if (!opt.noBoom) this.boom(t + 0.22, tgt[0], tgt[1], tgt[2], opt.s || 1.6, { blue: true });
    this.flashL.add(mz.x, mz.y, mz.z, t, 0.4, 1500, 0x8fd8ff);
  }
  gunFire(i, t0, t1, tgt, rate = 24) {
    this.gunFireWin.push({ i, t0, t1 });
    const keys = pick(this.gunTrack[i], (t0 + t1) / 2);
    const n = Math.floor((t1 - t0) * rate);
    for (let k = 0; k < n; k++) {
      const t = t0 + (k / n) * (t1 - t0); const p = sampleTrack(keys, t, {});
      const jx = (hash(k * 3.1 + i) - 0.5) * 6, jz = (hash(k * 7.7 + i) - 0.5) * 6;
      this.tracers.add({ a: [p.x, p.y - 0.8, p.z], b: [tgt[0] + jx, tgt[1], tgt[2] + jz], t0: t, speed: 190, len: 7, thick: 1.3 });
    }
    this.film.cue(t0, 'gunship_fire', { dur: t1 - t0 }, 'ny');
  }
  finalize() { (this.pendFire || []).forEach((f) => this._commitFire(f)); this.pendFire = []; this.group.add(this.fx.build()); }

  // ---------- per-frame ----------
  put(name, x, y, z, ry, pose, o = {}) {
    const a = name === 'zdeep' ? this.zdeep : this.actors[name];
    a.group.visible = true; a.place(x, y, z, ry); a.pose(pose);
    if (a.capeMesh) a.updateCape(this.T, o.flow ?? 0, o.wind ?? 1);
    a.heat(!!o.heat);
    if (o.smile != null) a.face(o.smile);
    if (name === 'homelander') { const sc = o.scorch || 0; if (!a.base) a.base = { suit: a.mats.suit.color.clone(), cape: a.capeMesh.material.color.clone() }; a.mats.suit.color.copy(a.base.suit).multiplyScalar(1 - 0.45 * sc); a.capeMesh.material.color.copy(a.base.cape).multiplyScalar(1 - 0.35 * sc); }
    return a;
  }
  putZ(i, x, y, z, ry, pose) { const s = this.zomb[i]; s.group.visible = true; s.place(x, y, z, ry); s.pose(pose); return s; }
  putSoldier(i, x, y, z, ry, pose) { const s = this.soldiers[i]; s.group.visible = true; s.place(x, y, z, ry); s.pose(pose); return s; }
  putCiv(i, x, y, z, ry, pose) { const s = this.civs[i]; s.group.visible = true; s.place(x, y, z, ry); s.pose(pose); return s; }
  stride(i) { return this.S[i]; }

  update(T) {
    this.T = T;
    const m = this.mood = moodAt(NY_MOODS, T);
    this.sky.mood({ hor: m.hor, zen: m.zen, glow: m.glow, glowAmt: m.glowAmt, glowDir: [-20, 700, -430], cloud: m.cloud, bright: m.bright, stars: m.stars });
    this.sky.update(T);
    this.hemi.color.set(m.hemiS); this.hemi.groundColor.set(m.hemiG); this.hemi.intensity = m.hemiI;
    this.sun.color.set(m.sunC); this.sun.intensity = m.sunI; this.sun.position.set(...m.sunDir);
    this.city.material.emissiveIntensity = m.win;
    this.destruct.forEach((o) => (o.m.material.emissiveIntensity = m.win));
    { const c = this.film.camera; const d = new THREE.Vector3(); c.getWorldDirection(d); this.fill.position.copy(c.position).addScaledVector(d, -2).add(new THREE.Vector3(2.5, 4, 0)); this.fill.target.position.copy(c.position).addScaledVector(d, 20); this.fill.intensity = 0.55 + m.hemiI * 0.55; this.fill.color.set(m.hemiS).lerp(new THREE.Color(0xffffff), 0.5); }
    this.flashL.update(T); this.beams.update(T); this.tracers.update(T);
    // vortices
    this.vorts.forEach((o, i) => o.v.update(T, (T - o.t) / 14 * (T < 600 ? 1 : 1), 0));
    this.horizonGlow.material.opacity = clamp((T - 100) / 40) * (T < 146 ? 1 : 0) * 0.5;
    this.crowd.update(T, this.film.camera.position); this.capeHold.visible = !!this.capeHoldOn; this.lighter.material.opacity = this.lighterOn ? 0.8 + 0.2 * Math.sin(T * 17) : 0; this.pods.update(T); this.crabs.update(T);
    // destructibles
    for (const o of this.destruct) {
      const a = T - o.d.t;
      if (a < 0) { o.m.visible = true; o.m.scale.y = 1; o.m.rotation.set(0, 0, 0); o.m.position.y = 0; o.rub.visible = false; continue; }
      const u = clamp(a / 4.5);
      const e = u * u;
      o.m.scale.y = Math.max(0.03, 1 - e * 0.98);
      o.m.position.y = 0;
      o.m.rotation.z = Math.sin(a * 9) * 0.015 * (1 - u) * (u < 1 ? 1 : 0);
      o.m.visible = u < 0.995; o.rub.visible = u > 0.3;
      o.rub.scale.setScalar(lerp(0.2, 1, smooth((u - 0.3) / 0.7)));
    }
    // citadel
    const cu = smooth((T - 524) / 40);
    this.citadel.visible = T > 524;
    this.citadel.scale.set(1, Math.max(0.02, cu), 1);
    this.citCore.material.opacity = 0.4 + 0.6 * cu;
    // heroes hidden by default
    for (const k in this.actors) this.actors[k].group.visible = false;
    { const cf = this.capeFall; const f = this.capeFn ? this.capeFn(T) : null; cf.visible = !!f; if (f) { cf.position.set(f[0], f[1], f[2]); cf.rotation.set(f[3], f[4], f[5]); const pa = cf.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const b = this.capeBase; const v = b[i * 3 + 1]; pa.setXYZ(i, b[i * 3] * (1 - 0.3 * Math.abs(Math.sin(T * 2 + v))), v, Math.sin(T * 5 + v * 4 + b[i * 3] * 3) * 0.18 * (1 - (v + 1.1) / 2.2 * 0.5)); } pa.needsUpdate = true; cf.geometry.computeVertexNormals(); } }
    this.zdeep.group.visible = false; this.jumper.visible = false; this.fcrabs.forEach((c) => (c.visible = false)); this.zomb.forEach((z) => (z.group.visible = false));
    { const dr = this.sDrop[0]; const on = dr && T > dr.t0 - 2 && T < dr.t1 + 2; this.dropBeam.visible = on; if (on) { const p0 = this.Spath[0].at(T); this.dropBeam.position.set(p0.x, 500, p0.z); this.dropBeam.material.opacity = 0.32 * clamp((T - dr.t0 + 2) / 1.5) * clamp((dr.t1 + 2 - T) / 1.5); } }
    this.soldiers.forEach((s) => (s.group.visible = false));
    this.civs.forEach((s) => (s.group.visible = false));
    // striders
    this.S.forEach((s, i) => {
      const path = this.Spath[i]; const dr = this.sDrop[i];
      if (!path) { s.g.visible = false; return; }
      const p = path.at(T);
      let y = 0, vis = true;
      if (dr) {
        if (T < dr.t0) vis = false;
        else if (T < dr.t1) { const u = (T - dr.t0) / (dr.t1 - dr.t0); y = (1 - smooth(u)) * dr.h; }
      }
      if (this.sDead[i] && T > this.sDead[i].t + 8) vis = this.sDead[i].keep !== false;
      s.g.visible = vis;
      if (!vis) return;
      s.g.position.set(p.x, y, p.z); s.g.rotation.y = this.sOverrideYaw?.[i] ?? p.yaw;
      const ph = p.dist / (5.5 * STR);
      let aimYaw = 0, aimPitch = 0, cannon = 0, gun = 0;
      for (const a of this.sAim) if (a.i === i && T >= a.t0 && T <= a.t1) {
        const dx = a.tgt[0] - p.x, dz = a.tgt[2] - p.z; let dy = Math.atan2(dx, dz) - p.yaw;
        while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
        aimYaw = clamp(dy, -1.1, 1.1) * smooth((T - a.t0) / 0.5);
        aimPitch = Math.atan2(11 * STR - a.tgt[1], Math.hypot(dx, dz)) * 0.9;
      }
      for (const f of this.sFire) if (f.i === i && T >= f.t && T < f.t + 0.35) cannon = 1 - (T - f.t) / 0.35;
      const dead = this.sDead[i] && T > this.sDead[i].t;
      s.update(ph, 5.5, { moving: p.moving && !dead, aimYaw, aimPitch, cannon, gun });
      if (dead) {
        const a = T - this.sDead[i].t; const u = clamp(a / 3.2);
        s.g.rotation.z = 0; s.g.rotation.x = 0; s.g.position.y = y - u * u * 8.5 * STR;
        s.body.rotation.x = u * 0.9; s.body.rotation.z = u * 0.4;
        s.eyeGlow.material.opacity = 0.15;
      }
    });
    // gunships
    this.gun.forEach((s, i) => {
      const k = pick(this.gunTrack[i], T);
      if (!k) { s.g.visible = false; return; }
      s.g.visible = true; placeFlyer(s.g, k, T, 1.0);
      let fire = 0; for (const w of this.gunFireWin) if (w.i === i && T >= w.t0 && T <= w.t1) fire = 1;
      s.update(T, fire);
    });
    this.drop.forEach((s, i) => {
      const k = pick(this.dropTrack[i], T);
      if (!k) { s.g.visible = false; return; }
      s.g.visible = true; placeFlyer(s.g, k, T, 0.5);
    });
    this.jets.forEach((j, i) => {
      const k = pick(this.jetTrack[i], T);
      if (!k) { j.visible = false; return; }
      j.visible = true; const st = placeFlyer(j, k, T, 1.4);
      j.afterburn(0.7 + 0.3 * Math.sin(T * 40));
      j.wings.forEach((w, n) => (w.rotation.y = (n ? 1 : -1) * 0.5));
    });
    // tanks
    this.tanks.forEach((t, i) => {
      const tt = this.tankPos?.[i]; if (!tt) { t.visible = false; return; }
      t.visible = T >= tt.t0; t.position.set(tt.x, 0, tt.z); t.rotation.y = tt.ry;
      let f = 0; for (const e of this.tankFire) if (e.i === i && T >= e.t && T < e.t + 0.16) f = 1 - (T - e.t) / 0.16;
      t.flash.material.opacity = f;
      const kill = this.tankDead[i];
      if (kill && T > kill) { const a = clamp((T - kill) / 0.5); t.rotation.z = 0.25 * a; t.position.y = 0.2 * a; t.turret.rotation.y = 0.8 * a; t.flash.material.opacity = 0; t.turret.position.y = 1.9 + 0.5 * a; }
      else t.turret.rotation.y = tt.aim ?? 0;
    });
    // banners
    const on = T > 530;
    this.banners.forEach((b, i) => { b.visible = on; if (on) { b.position.set(i < 3 ? -20 : 20, 24 + (i % 3) * 3, -30 - (i % 3) * 70); b.rotation.y = i < 3 ? Math.PI / 2 : -Math.PI / 2; b.scale.setScalar(1 + (i % 2) * 0.3); } });
  }
  fogAt() { return { density: this.mood.fogD, color: this.mood.fogC }; }
}
