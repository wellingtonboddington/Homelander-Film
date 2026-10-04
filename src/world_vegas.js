import * as THREE from 'three';
import { World } from './film.js';
import { FX, Sky, Vortex, BeamPool, FlashLights, glowSprite } from './fx.js';
import { M, box, sph, cyl, mesh, Strider, buildCityGeometry, makeStratosphere, makeCar, CHAR } from './models.js';
import { PodField, CrabSwarm, Crowd, makeCars, makeLamps } from './parts.js';
import { Path, moodAt } from './common.js';
import { asphaltTex, roadTex, glowTex } from './textures.js';
import { rng, clamp, lerp, smooth, TAU } from './util.js';
import { STR } from './world_ny.js';

export class VegasWorld extends World {
  constructor(film) {
    super(film, 'vegas');
    this.fogDensity = 0.0011; this.fogColor = 0x2a3c42; this.bg = 0x2a3c42;
    const g = this.group; this.fx = new FX();
    this.beams = new BeamPool(10); this.flashL = new FlashLights(2, 0x9fe0ff, 120);
    this.hemi = new THREE.HemisphereLight(0x7aa4b8, 0x30241c, 1.1); this.sun = new THREE.DirectionalLight(0x9fd8ff, 1.6); this.sun.position.set(-40, 300, -420);
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.9); g.add(this.fill, this.fill.target);
    g.add(this.hemi, this.sun, this.flashL.group);
    this.sky = new Sky(3600); g.add(this.sky.mesh);
    this.sky.mood({ hor: 0x4a6a70, zen: 0x0d1a22, glow: 0x7fdcff, glowAmt: 1.1, glowDir: [10, 620, -420], cloud: 1.15, bright: 1.05, stars: 0 });
    // desert + road
    const dt = asphaltTex().clone(); dt.repeat.set(300, 300); dt.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000).rotateX(-Math.PI / 2), M.lam(0x6a5a46, { map: dt }));
    ground.position.y = -0.05; g.add(ground);
    const rt = roadTex().clone(); rt.repeat.set(1, 52); rt.needsUpdate = true;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(26, 2600).rotateX(-Math.PI / 2), M.lam(0xffffff, { map: rt })); road.position.set(0, 0.02, -600); g.add(road);
    // strip hotels
    const r = rng(8); const blocks = [];
    for (let iz = -22; iz <= 2; iz++) for (const sx of [-1, 1]) {
      const cz = iz * 62 + (r() - 0.5) * 20, cx = sx * (46 + r() * 30);
      const big = r() < 0.16;
      blocks.push({ x: cx, z: cz, w: 34 + r() * 26, d: 40 + r() * 20, h: big ? 80 + r() * 90 : 14 + r() * 40, shade: 0.8 + r() * 0.5 });
    }
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = 260 + r() * 1100; if (Math.sin(a) > -0.1 && Math.abs(Math.cos(a)) < 0.6) continue; blocks.push({ x: Math.cos(a) * d, z: -200 + Math.sin(a) * d * 0.9 - 300, w: 40 + r() * 60, d: 40 + r() * 60, h: 12 + Math.pow(r(), 2) * 90, shade: 0.7 }); }
    this.city = buildCityGeometry({ seed: 9, blocks, lit: 0.5, warm: 0.5, tint: 0xa8a49a }); g.add(this.city);
    // mountains
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, d = 2300 + r() * 300; const m = mesh(new THREE.ConeGeometry(260 + r() * 260, 260 + r() * 240, 5), M.lam(0x1a1f22), [Math.cos(a) * d, 100, Math.sin(a) * d]); m.rotation.y = r() * 3; g.add(m); }
    // neon
    const neonCol = [0xff3a8a, 0x3ae0ff, 0xffd23a, 0xff6a2a, 0x8a5aff];
    const np = new Float32Array(60 * 3), nc = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) { const b = blocks[(r() * 24) | 0]; np.set([b.x + (r() - 0.5) * b.w, 6 + r() * 30, b.z + 0.5 * b.d * (b.x > 0 ? 0 : 0)], i * 3); const c = new THREE.Color(neonCol[(r() * 5) | 0]); nc.set([c.r, c.g, c.b], i * 3); }
    const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.BufferAttribute(np, 3)); ng.setAttribute('color', new THREE.BufferAttribute(nc, 3));
    const npts = new THREE.Points(ng, new THREE.PointsMaterial({ map: glowTex(), size: 18, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); npts.frustumCulled = false; g.add(npts);
    // Stratosphere
    this.strat = makeStratosphere(); this.strat.position.set(-58, 0, -118); g.add(this.strat);
    makeCars(30, g, { z0: -300, z1: 380, rows: [-8, -3.5, 3.5, 8] });
    this.lamps = makeLamps(g, { z0: -500, z1: 400, step: 32, xs: [-14, 14], color: 0xffc890 });
    this.crowd = new Crowd(60, g, { z0: -60, z1: 70, x0: -12, x1: 12, seed: 6, calm: 0.4, panicT: 17, panic: 5, fadeT: 999 });
    // vortices (ref composition)
    this.vorts = [
      { v: new Vortex(440), p: [20, 610, -430], t: 1 },
      { v: new Vortex(280), p: [330, 560, -330], t: 3 },
      { v: new Vortex(250), p: [-300, 270, -560], t: 2 },
    ];
    this.vorts.forEach((o) => { o.v.group.position.set(...o.p); g.add(o.v.group); });
    this.vorts[0].v.setLen(560); this.vorts[1].v.setLen(300);
    this.hglow = glowSprite(0x9fe6ff, 260, 0.9); this.hglow.position.set(-170, 40, -500); g.add(this.hglow);
    // pods + crabs
    const pr = rng(14); const pods = [];
    for (let i = 0; i < 18; i++) pods.push({ x: (pr() - 0.5) * 60, z: -120 + pr() * 170, t: 22.5 + pr() * 7 + (i < 6 ? -2 : 0), s: 1.5 + pr() * 0.5, fx: 40 + pr() * 80, fz: -40 - pr() * 60 });
    pods.push({ x: 7, z: -8, t: 21.8, s: 1.9, fx: 16, fz: -58 }); pods.push({ x: -5, z: -30, t: 23.6, s: 1.7, fx: 30, fz: -50 });
    this.podData = pods;
    this.pods = new PodField(pods, { parent: g, fx: this.fx });
    this.crabs = new CrabSwarm(pods, g, 2, 8, 0, 0);
    // strider in distance
    this.S = new Strider(); this.S.g.scale.setScalar(STR); g.add(this.S.g);
    this.Spath = new Path([[0, 14, -480], [22, 14, -480], [26, 14, -420], [29, 12, -300], [34, 6, -160], [40, 2, -60], [46, -4, 20]]);
    this.sdrop = { t0: 22, t1: 27, h: 0 };
    this.fx.burn(-40, 2, -60, 24, 70, 1.6); this.fx.burn(34, 2, -90, 26, 70, 1.3); this.fx.burn(-34, 2, -200, 25, 70, 2.2);
    this.fx.explosion(-40, 20, -70, 27, 3); this.fx.explosion(36, 30, -85, 29.5, 3.4);
    this.film.cue(27, 'explosion', { s: 3 }, 'vegas'); this.film.cue(29.5, 'explosion', { s: 3.4 }, 'vegas');
    this.flashL.add(-40, 20, -70, 27, 0.7, 4000, 0xffa050); this.flashL.add(36, 30, -85, 29.5, 0.7, 4000, 0xffa050);
    this.hero = null; this.actors = {};
    this.mood = { fogD: 0.0011, fogC: 0x2a3c42 };
    g.add(this.beams.group, this.fx.build());
  }
  update(T) {
    const c = this.film.camera; const d = new THREE.Vector3(); c.getWorldDirection(d);
    this.fill.position.copy(c.position).addScaledVector(d, -2).add(new THREE.Vector3(2, 4, 0)); this.fill.target.position.copy(c.position).addScaledVector(d, 20);
    this.sky.update(T);
    this.vorts.forEach((o) => o.v.update(T, (T - o.t) / 8, 0));
    this.flashL.update(T); this.beams.update(T); this.crowd.update(T, this.film.camera.position); this.pods.update(T); this.crabs.update(T);
    const p = this.Spath.at(T); const dr = this.sdrop;
    this.S.g.visible = T >= dr.t0;
    this.S.g.position.set(p.x, 0, p.z); this.S.g.rotation.y = p.yaw;
    this.S.update(p.dist / (5.5 * STR), 5.5, { moving: p.moving });
    // flicker neon sky pulse
    this.hemi.intensity = 1.0 + 0.1 * Math.sin(T * 7) * (T > 20 ? 1 : 0);
  }
  fogAt() { return this.mood.fogD ? { density: this.mood.fogD, color: this.mood.fogC } : { density: 0.001, color: 0x2a3c42 }; }
}
