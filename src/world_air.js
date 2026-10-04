import * as THREE from 'three';
import { World } from './film.js';
import { FX, Sky, Vortex, glowSprite, BeamPool, FlashLights } from './fx.js';
import { M, box, sph, cyl, mesh, makeJet, makeChinook, makeTank, CHAR, P } from './models.js';
import { moodAt, sampleTrack, placeFlyer, trackVisible, pick } from './common.js';
import { asphaltTex, concreteTex, glowTex } from './textures.js';
import { rng, clamp, lerp, smooth, TAU } from './util.js';

export class AirWorld extends World {
  constructor(film) {
    super(film, 'air');
    this.bg = 0x080d12; this.fogDensity = 0.0042; this.fogColor = 0x0e1a22;
    const g = this.group; this.fx = new FX();
    this.flashL = new FlashLights(2, 0xffa050, 140); g.add(this.flashL.group);
    this.sky = new Sky(3600); g.add(this.sky.mesh);
    this.sky.mood({ hor: 0x2a4a58, zen: 0x05090c, glow: 0x6fd0ff, glowAmt: 0.9, glowDir: [-20, 300, -900], cloud: 1.1, bright: 1.0, stars: 0.3 });
    const at = asphaltTex().clone(); at.repeat.set(250, 250); at.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2), M.lam(0x3a3e42, { map: at })); ground.position.y = -0.05; g.add(ground);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(1400, 600).rotateX(-Math.PI / 2), M.lam(0x1c2a1a)); grass.position.set(40, 0.0, -150); g.add(grass);
    g.add(mesh(new THREE.PlaneGeometry(520, 60).rotateX(-Math.PI / 2), M.lam(0x44474b, { map: at }), [0, 0.03, 40]));
    // hangar
    const hm = M.std(0x7a8086, { roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide });
    // use simpler: half cylinder along z axis
    const half = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 50, 24, 1, true, -Math.PI / 2, Math.PI), hm);
    half.rotation.set(Math.PI / 2, 0, 0); half.position.set(36, 0, -45); half.scale.set(1, 1, 0.75); g.add(half);
    const door = box(26, 11, 0.5, M.std(0x8a9096, { roughness: 0.6, metalness: 0.4 }), [36, 5.5, -19.5]); g.add(door);
    for (let i = 0; i < 9; i++) g.add(box(26, 0.12, 0.54, M.std(0x5a6066), [36, 1 + i * 1.2, -19.4]));
    const ribs = M.std(0x9aa0a6, { metalness: 0.4 });
    for (let i = 0; i < 12; i++) { const a = (i / 11) * Math.PI; g.add(box(0.8, 0.8, 0.8, ribs, [36 + Math.cos(a) * 16, Math.sin(a) * 12, -19.6])); }
    g.add(box(0.5, 6, 0.4, M.emi(0xffe3a0), [20, 3, -19]));
    const wl = glowSprite(0xffd890, 12, 0.7); wl.position.set(21, 4, -18); g.add(wl);
    // ground lights (runway edge/taxi)
    const lp = []; for (let x = -240; x <= 240; x += 14) { lp.push(x, 0.4, 12, x, 0.4, 68); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const blue = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTex(), color: 0x5aa0ff, size: 2.8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); blue.frustumCulled = false; g.add(blue);
    // trees
    const tr = rng(4); const cm = new THREE.InstancedMesh(new THREE.ConeGeometry(4, 18, 6), M.lam(0x0c1410), 160); const mm = new THREE.Matrix4();
    for (let i = 0; i < 160; i++) { const x = -300 + tr() * 700, z = -75 - tr() * 90; const s = 0.7 + tr() * 0.9; mm.compose(new THREE.Vector3(x, 8 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); cm.setMatrixAt(i, mm); }
    cm.frustumCulled = false; g.add(cm);
    // lights
    this.hemi = new THREE.HemisphereLight(0x7aa8c8, 0x1c2024, 1.6); g.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x9ac8f0, 3.2); this.moon.position.set(-200, 260, -600); g.add(this.moon);
    this.fill = new THREE.DirectionalLight(0xd8e8ff, 0.9); g.add(this.fill, this.fill.target);
    this.sodium = new THREE.PointLight(0xffc27a, 55, 60, 1.5); this.sodium.position.set(18, 7, -10); g.add(this.sodium);
    this.vort = new Vortex(520); this.vort.group.position.set(-60, 520, -1100); g.add(this.vort.group);
    // jets parked: F-14 (sweep), F-16 (single), F-15
    this.parked = [];
    const mk = (c, x, z, ry, s = 1) => { const j = makeJet(c); j.scale.setScalar(0.9 * s); j.position.set(x, 1.55, z); j.rotation.y = ry; g.add(j); j.afterburn(0); this.parked.push(j); return j; };
    this.j14 = mk(0x6a7178, -4, 18, -0.9, 1.1); this.j16 = mk(0x7c838a, 22, 10, -0.75, 0.85); this.j15 = mk(0x9aa2a8, 52, 6, -0.7, 1.05); mk(0x6a7178, 8, -9, -0.8, 1.0);
    // take-off jets
    this.jets = []; this.jetTrack = [];
    for (let i = 0; i < 3; i++) { const j = makeJet(0x6c747b); j.visible = false; g.add(j); this.jets.push(j); this.jetTrack.push([]); }
    // chinooks with cargo
    this.chin = []; this.chinTrack = [];
    for (let i = 0; i < 3; i++) { const c = makeChinook(true); c.visible = false; g.add(c); this.chin.push(c); this.chinTrack.push([]); }
    // vehicles & crew
    this.crew = []; for (let i = 0; i < 6; i++) { const s = CHAR.soldier(i); s.group.visible = false; g.add(s.group); this.crew.push(s); }
    this.tank = []; this.tankTrack = [];
    g.add(this.fx.build());
  }
  put(i, x, z, ry, pose) { const s = this.crew[i]; s.group.visible = true; s.place(x, 0, z, ry); s.pose(pose); }
  update(T) {
    const c = this.film.camera; const d = new THREE.Vector3(); c.getWorldDirection(d);
    this.fill.position.copy(c.position).addScaledVector(d, -2).add(new THREE.Vector3(2, 4, 0)); this.fill.target.position.copy(c.position).addScaledVector(d, 20);
    this.sky.update(T); this.vort.update(T, 1, 0); this.flashL.update(T);
    this.crew.forEach((s) => (s.group.visible = false));
    this.jets.forEach((j, i) => { const k = pick(this.jetTrack[i], T); if (!k) { j.visible = false; return; } j.visible = true; const st = placeFlyer(j, k, T, 1.2); const burn = clamp((T - k[0][0]) / 2); j.afterburn(burn * (0.8 + 0.2 * Math.sin(T * 50))); j.scale.setScalar(0.95); j.wings.forEach((w, n) => (w.rotation.y = (n ? 1 : -1) * lerp(-0.1, 0.5, smooth((T - k[0][0] - 3) / 4)))); });
    this.chin.forEach((c2, i) => { const k = pick(this.chinTrack[i], T); if (!k) { c2.visible = false; return; } c2.visible = true; placeFlyer(c2, k, T, 0.3); c2.spin(T); if (c2.cargo) { c2.cargo.rotation.z = Math.sin(T * 1.7 + i) * 0.07; c2.cargo.rotation.x = Math.sin(T * 1.3 + i) * 0.05; } });
    this.sodium.intensity = 55 + 6 * Math.sin(T * 40);
  }
  fogAt() { return { density: 0.0042, color: 0x0e1a22 }; }
}
