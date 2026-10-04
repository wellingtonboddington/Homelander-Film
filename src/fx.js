import * as THREE from 'three';
import { glowTex, streakTex, swirlTex, cloudTex } from './textures.js';
import { rng, clamp, lerp, smooth, hash, V, orient } from './util.js';

// shared uniforms updated by film each frame
export const FXU = { uScale: { value: 800 } };

/* ---------------------------------------------------------------
   GPU particles evaluated analytically from absolute film time.
---------------------------------------------------------------- */
const PVERT = /* glsl */`
uniform float uT; uniform float uScale; uniform vec3 uGrav; uniform float uDrag;
attribute vec3 aVel; attribute vec4 aTime; attribute vec4 aC0; attribute vec4 aC1;
varying vec4 vC;
void main(){
  float age = uT - aTime.x; float k = age / aTime.y;
  if(age < 0. || k > 1.){ gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 0.; vC=vec4(0.); return; }
  vec3 disp = uDrag > 0. ? aVel * (1.-exp(-uDrag*age))/uDrag : aVel*age;
  vec3 p = position + disp + 0.5*uGrav*age*age;
  vec4 mv = modelViewMatrix * vec4(p,1.);
  float size = mix(aTime.z, aTime.w, k);
  gl_PointSize = clamp(size * uScale / max(-mv.z, 0.1), 0., 420.);
  vC = mix(aC0, aC1, k);
  vC.a *= smoothstep(0.,0.06,k);
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = /* glsl */`
varying vec4 vC;
void main(){
  vec2 q = gl_PointCoord - .5; float d = length(q)*2.;
  float a = smoothstep(1., .25, d);
  if(vC.a*a < .004) discard;
  gl_FragColor = vec4(vC.rgb, vC.a*a);
}`;

export class Particles {
  constructor({ additive = false, grav = [0, 0, 0], drag = 0 } = {}) {
    this.items = [];
    this.additive = additive; this.grav = grav; this.drag = drag;
    this.mesh = null;
  }
  add(p) { this.items.push(p); }
  // p: {x,y,z, vx,vy,vz, t0, life, s0, s1, c0:[r,g,b,a], c1:[r,g,b,a]}
  finalize() {
    const n = this.items.length;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), tm = new Float32Array(n * 4), c0 = new Float32Array(n * 4), c1 = new Float32Array(n * 4);
    this.items.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3); vel.set([p.vx || 0, p.vy || 0, p.vz || 0], i * 3);
      tm.set([p.t0, p.life, p.s0, p.s1], i * 4); c0.set(p.c0, i * 4); c1.set(p.c1, i * 4);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aTime', new THREE.BufferAttribute(tm, 4));
    g.setAttribute('aC0', new THREE.BufferAttribute(c0, 4));
    g.setAttribute('aC1', new THREE.BufferAttribute(c1, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.uT = { value: -1e5 };
    const m = new THREE.ShaderMaterial({
      uniforms: { uT: this.uT, uScale: FXU.uScale, uGrav: { value: new THREE.Vector3(...this.grav) }, uDrag: { value: this.drag } },
      vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false,
      blending: this.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(g, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = this.additive ? 6 : 5;
    this.items = null;
    return this.mesh;
  }
  update(T) { if (this.uT) this.uT.value = T; }
}

/* A bundle of particle systems for a world + helpers to author events */
export class FX {
  constructor() {
    this.fire = new Particles({ additive: true, drag: 1.6 });
    this.sparks = new Particles({ additive: true, grav: [0, -9, 0], drag: 0.2 });
    this.smoke = new Particles({ grav: [0, 0.7, 0], drag: 0.7 });
    this.dust = new Particles({ grav: [0, -0.3, 0], drag: 1.2 });
    this.glow = new Particles({ additive: true, drag: 0 });
    this.group = new THREE.Group();
    this.r = rng(77);
  }
  all() { return [this.fire, this.sparks, this.smoke, this.dust, this.glow]; }
  build() { this.all().forEach((s) => this.group.add(s.finalize())); return this.group; }
  update(T) { this.all().forEach((s) => s.update(T)); }

  explosion(x, y, z, t0, s = 1, opt = {}) {
    const r = this.r; const tint = opt.blue ? 1 : 0;
    this.glow.add({ x, y, z, t0, life: 0.18, s0: 9 * s, s1: 14 * s, c0: tint ? [0.7, 0.9, 1, 1] : [1, 0.95, 0.8, 1], c1: tint ? [0.3, 0.6, 1, 0] : [1, 0.5, 0.1, 0] });
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, e = (r() - 0.3) * 1.2, sp = (2 + r() * 5) * s;
      this.fire.add({ x, y, z, vx: Math.cos(a) * Math.cos(e) * sp, vy: Math.sin(e) * sp + 1.5 * s, vz: Math.sin(a) * Math.cos(e) * sp, t0: t0 + r() * 0.08, life: 0.7 + r() * 0.7, s0: 1.8 * s, s1: (4 + r() * 3) * s,
        c0: tint ? [0.6, 0.85, 1, 0.9] : [1, 0.75, 0.35, 0.95], c1: tint ? [0.1, 0.3, 1, 0] : [0.9, 0.18, 0.02, 0] });
    }
    for (let i = 0; i < 22; i++) {
      const a = r() * 6.28, sp = (6 + r() * 16) * s, up = (3 + r() * 12) * s;
      this.sparks.add({ x, y, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, t0, life: 0.9 + r() * 1.2, s0: 0.22 * s + 0.05, s1: 0.05, c0: tint ? [0.6, 0.9, 1, 1] : [1, 0.8, 0.4, 1], c1: tint ? [0.2, 0.4, 1, 0] : [1, 0.3, 0.05, 0] });
    }
    for (let i = 0; i < 12; i++) {
      const a = r() * 6.28, sp = (1 + r() * 3) * s;
      this.smoke.add({ x: x + (r() - 0.5) * s, y: y + r() * s, z: z + (r() - 0.5) * s, vx: Math.cos(a) * sp, vy: (2 + r() * 3) * s, vz: Math.sin(a) * sp, t0: t0 + 0.1 + r() * 0.3, life: 5 + r() * 5, s0: 2.5 * s, s1: (9 + r() * 6) * s,
        c0: [0.1, 0.1, 0.1, 0.75], c1: [0.04, 0.045, 0.05, 0] });
    }
  }
  // sustained fire (flames + smoke column) from t0 to t1 at pos
  burn(x, y, z, t0, t1, s = 1, smoke = true) {
    const r = this.r;
    const n = Math.max(6, Math.floor((t1 - t0) * 3.2 * s));
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * (t1 - t0);
      this.fire.add({ x: x + (r() - 0.5) * s, y, z: z + (r() - 0.5) * s, vx: (r() - 0.5) * s, vy: (2.2 + r() * 2) * s, vz: (r() - 0.5) * s, t0: t, life: 1.3 + r(), s0: 1.6 * s, s1: 0.5 * s, c0: [1, 0.55, 0.15, 0.9], c1: [0.8, 0.1, 0, 0] });
      if (smoke && i % 2 === 0) this.smoke.add({ x, y: y + 1 * s, z, vx: (r() - 0.5) * 2, vy: (3 + r() * 2) * s, vz: (r() - 0.5) * 2, t0: t, life: 7 + r() * 4, s0: 2 * s, s1: 11 * s, c0: [0.07, 0.07, 0.07, 0.7], c1: [0.03, 0.03, 0.04, 0] });
    }
  }
  dustBurst(x, y, z, t0, s = 1, n = 18) {
    const r = this.r;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, sp = (2 + r() * 7) * s;
      this.dust.add({ x, y, z, vx: Math.cos(a) * sp, vy: (1 + r() * 4) * s, vz: Math.sin(a) * sp, t0: t0 + r() * 0.2, life: 4 + r() * 4, s0: 3 * s, s1: (10 + r() * 8) * s, c0: [0.45, 0.42, 0.4, 0.65], c1: [0.25, 0.25, 0.26, 0] });
    }
  }
  // trail of glowing points along path function p(u)->[x,y,z], u in 0..1 over time t0..t1
  trail(pathFn, t0, t1, n, size, c0, c1, life = 0.8) {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), p = pathFn(u);
      this.glow.add({ x: p[0], y: p[1], z: p[2], t0: lerp(t0, t1, u), life, s0: size, s1: size * 0.3, c0, c1 });
    }
  }
}

/* ---------------------------------------------------------------
   Sprites
---------------------------------------------------------------- */
export function glowSprite(color = 0xffffff, size = 10, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  s.renderOrder = 7;
  return s;
}

/* ---------------------------------------------------------------
   Sky dome
---------------------------------------------------------------- */
export class Sky {
  constructor(radius = 3000) {
    this.u = {
      uCloud: { value: cloudTex() }, uTime: { value: 0 },
      uHor: { value: new THREE.Color(0x2a3a44) }, uZen: { value: new THREE.Color(0x0b1217) },
      uGlowDir: { value: new THREE.Vector3(0, 1, 0).normalize() }, uGlowCol: { value: new THREE.Color(0x66ccff) }, uGlowAmt: { value: 0.0 },
      uCloudAmt: { value: 1.0 }, uBright: { value: 1.0 }, uStars: { value: 0.0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w*0.9999; }`,
      fragmentShader: `
      uniform sampler2D uCloud; uniform float uTime; uniform vec3 uHor,uZen,uGlowCol,uGlowDir; uniform float uGlowAmt,uCloudAmt,uBright,uStars;
      varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 d = normalize(vD);
        float y = clamp(d.y,-0.2,1.);
        vec3 base = mix(uHor, uZen, pow(max(y,0.),0.55));
        float u = atan(d.z,d.x)/6.2831853 + uTime*0.002;
        float v = acos(clamp(d.y,-1.,1.))/3.14159265;
        float c = texture2D(uCloud, vec2(u*2.0, v*1.6 + 0.02)).r;
        float c2 = texture2D(uCloud, vec2(u*3.1+0.37 + uTime*0.003, v*2.4 + 0.3)).r;
        float cl = clamp(c*0.7 + c2*0.5, 0., 1.) * uCloudAmt;
        vec3 col = base * (0.35 + cl*1.25);
        float g = pow(max(dot(d, normalize(uGlowDir)),0.),6.);
        col += uGlowCol * g * uGlowAmt * (0.4 + cl);
        col += uGlowCol * pow(max(1.-abs(d.y),0.),5.) * 0.06 * uGlowAmt;
        vec2 sp = floor(vec2(u*900., v*450.)); float st = step(0.9975, h(sp)) * uStars * (1.-cl);
        col += vec3(st);
        gl_FragColor = vec4(col*uBright, 1.);
      }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  update(T) { this.u.uTime.value = T; }
  mood(m) {
    this.u.uHor.value.set(m.hor); this.u.uZen.value.set(m.zen);
    this.u.uGlowCol.value.set(m.glow ?? 0x66ccff); this.u.uGlowAmt.value = m.glowAmt ?? 0;
    if (m.glowDir) this.u.uGlowDir.value.set(...m.glowDir).normalize();
    this.u.uCloudAmt.value = m.cloud ?? 1; this.u.uBright.value = m.bright ?? 1; this.u.uStars.value = m.stars ?? 0;
  }
}

/* ---------------------------------------------------------------
   Portal vortex (superportal storm) with energy tendril & lightning
---------------------------------------------------------------- */
export class Vortex {
  constructor(radius = 420, opt = {}) {
    this.group = new THREE.Group();
    this.R = radius;
    const sm = new THREE.MeshBasicMaterial({ map: swirlTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, color: opt.tint ?? 0xffffff });
    this.swirl = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), sm);
    // Circle UV maps to disc; rotate to horizontal facing down
    this.swirl.rotation.x = Math.PI / 2;
    this.swirl.renderOrder = 1;
    this.group.add(this.swirl);
    const sm2 = sm.clone(); sm2.opacity = 0.65;
    this.swirl2 = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.55, 40), sm2);
    this.swirl2.rotation.x = Math.PI / 2; this.swirl2.position.y = 12; this.swirl2.renderOrder = 0;
    this.group.add(this.swirl2);
    this.core = glowSprite(0xaee9ff, radius * 0.55, 1);
    this.core.position.y = -20; this.group.add(this.core);
    this.core2 = glowSprite(0xffffff, radius * 0.22, 1);
    this.core2.position.y = -30; this.group.add(this.core2);
    this.halo = glowSprite(0x5fc8ff, radius * 1.6, 0.35);
    this.halo.position.y = -10; this.group.add(this.halo);
    // tendril (energy column / "jellyfish")
    const tm = new THREE.MeshBasicMaterial({ map: streakTex(), color: 0x7fd8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.tendrils = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.ConeGeometry(radius * 0.07, 1, 6, 1, true);
      g.rotateX(Math.PI); // wide at top
      g.translate(0, -0.5, 0);
      const m = new THREE.Mesh(g, tm);
      m.renderOrder = 3;
      m.userData = { ph: i * 1.7, ang: i * 1.05 };
      this.group.add(m); this.tendrils.push(m);
    }
    this.tendrilLen = radius * 0.9;
    this.bolts = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xbfeaff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.bolts.frustumCulled = false; this.group.add(this.bolts);
    this.boltSeed = Math.random();
  }
  setLen(len) { this.tendrilLen = len; }
  update(T, open = 1, pulse = 0) {
    const o = smooth(open);
    this.group.visible = o > 0.001;
    this.swirl.rotation.z = -T * 0.09; this.swirl2.rotation.z = T * 0.05 + 1;
    this.swirl.scale.setScalar(0.2 + 0.8 * o); this.swirl2.scale.setScalar(0.2 + 0.8 * o);
    const flick = 0.92 + 0.08 * Math.sin(T * 13) + pulse * 0.25;
    this.core.material.opacity = flick * o; this.core2.material.opacity = flick * o;
    this.halo.material.opacity = 0.3 * o;
    this.tendrils.forEach((m, i) => {
      const len = this.tendrilLen * (0.55 + 0.45 * Math.sin(T * 1.7 + m.userData.ph)) * o;
      const a = m.userData.ang + Math.sin(T * 0.6 + i) * 0.2;
      const rr = this.R * 0.08 * (i % 3);
      m.position.set(Math.cos(a) * rr, -26, Math.sin(a) * rr);
      m.scale.set(1 + 0.25 * Math.sin(T * 5 + i), Math.max(len, 0.01), 1 + 0.25 * Math.cos(T * 4 + i));
      m.rotation.y = T * 0.8 + i;
    });
    // lightning flashes
    const slot = Math.floor(T * 5);
    const on = hash(slot * 1.37 + this.boltSeed * 100) > 0.55 && (T * 5 - slot) < 0.55;
    this.bolts.visible = on && o > 0.5;
    if (on) {
      if (this._slot !== slot) { this._slot = slot; this._buildBolts(slot); }
    }
  }
  _buildBolts(slot) {
    const r = rng(slot * 7919 + 13);
    const pts = [];
    const nb = 2 + (r() * 3 | 0);
    for (let b = 0; b < nb; b++) {
      const a = r() * 6.28, rad = this.R * (0.2 + r() * 0.75);
      let p = new THREE.Vector3(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      const end = new THREE.Vector3(Math.cos(a + (r() - 0.5)) * rad * (0.6 + r() * 0.8), -this.R * (0.35 + r() * 0.5), Math.sin(a + (r() - 0.5)) * rad * 0.9);
      const N = 10;
      for (let i = 1; i <= N; i++) {
        const q = p.clone().lerp(end, 1 / (N - i + 1));
        q.x += (r() - 0.5) * this.R * 0.09; q.z += (r() - 0.5) * this.R * 0.09; q.y += (r() - 0.5) * 6;
        pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
        p = q;
      }
    }
    this.bolts.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.bolts.geometry.computeBoundingSphere();
  }
}

/* ---------------------------------------------------------------
   Beams & tracers pools (stateless, driven by event lists)
---------------------------------------------------------------- */
export class BeamPool {
  // events: {a:[x,y,z], b:[x,y,z], t0, dur, w, color, travel}
  constructor(max = 24) {
    this.events = []; this.meshes = [];
    this.group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.visible = false; m.renderOrder = 8;
      const gl = glowSprite(0xffffff, 4, 1); m.add(gl); m.userData.gl = gl;
      this.group.add(m); this.meshes.push(m);
    }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
  }
  add(e) { this.events.push(e); return this; }
  update(T) {
    let k = 0;
    for (const e of this.events) {
      if (T < e.t0 || T > e.t0 + e.dur) continue;
      if (k >= this.meshes.length) break;
      const u = (T - e.t0) / e.dur;
      const m = this.meshes[k++];
      m.visible = true;
      const a = this._a.set(...e.a), b = this._b.set(...e.b);
      let A = a, B = b;
      if (e.travel) { // projectile segment travelling a->b
        const head = clamp(u * 1.15), tail = clamp(u * 1.15 - e.travel);
        A = a.clone().lerp(b, tail); B = a.clone().lerp(b, head);
      }
      const fade = e.travel ? 1 : (1 - u) * smooth(u * 8);
      orient(m, A, B, (e.w ?? 0.3) * (e.travel ? 1 : (0.6 + 0.4 * (1 - u))));
      m.material.color.set(e.color ?? 0xffffff);
      m.material.opacity = fade * (e.opacity ?? 0.9);
      m.userData.gl.position.set(0, 0.5, 0);
      m.userData.gl.scale.set((e.w ?? 0.3) * 14 / Math.max(m.scale.y, 0.001) * 4, (e.w ?? 0.3) * 14, 1);
      m.userData.gl.scale.set((e.w ?? 0.3) * 18, (e.w ?? 0.3) * 18, 1);
      m.userData.gl.material.color.set(e.color ?? 0xffffff);
      m.userData.gl.material.opacity = fade * 0.9;
      // glow positioned at head for travelling shots
      if (e.travel) m.userData.gl.position.set(0, 0.5, 0);
    }
    for (; k < this.meshes.length; k++) this.meshes[k].visible = false;
  }
}

// instanced tracer bullets (many tiny streaks)
export class Tracers {
  constructor(max = 200) {
    this.events = [];
    const g = new THREE.BoxGeometry(0.06, 0.06, 1.0);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffd78a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), max);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.max = max;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  add(e) { this.events.push(e); return this; } // {a,b,t0,speed,len,thick}
  // burst: n bullets from a to b spread randomly between t0..t1
  burst(a, b, t0, t1, rate, spread = 3, speed = 160, color) {
    const r = rng((t0 * 100 | 0) + 17);
    const n = Math.floor((t1 - t0) * rate);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / n) * (t1 - t0);
      this.add({ a, b: [b[0] + (r() - 0.5) * spread, b[1] + (r() - 0.5) * spread, b[2] + (r() - 0.5) * spread], t0: t, speed, color });
    }
  }
  update(T) {
    let k = 0;
    for (const e of this.events) {
      if (T < e.t0) continue;
      const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], dz = e.b[2] - e.a[2];
      const dist = Math.hypot(dx, dy, dz); const dur = dist / (e.speed || 160);
      const age = T - e.t0; if (age > dur) continue;
      if (k >= this.max) break;
      const u = age / dur;
      const len = e.len ?? 6;
      this._d.set(dx / dist, dy / dist, dz / dist);
      this._p.set(e.a[0] + dx * u, e.a[1] + dy * u, e.a[2] + dz * u);
      this._q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._d);
      this._s.set(e.thick ?? 1, e.thick ?? 1, len);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(k++, this._m);
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// pooled dynamic lights driven by flash events: returns intensity function
export class FlashLights {
  constructor(n = 2, color = 0xffaa55, dist = 80) {
    this.lights = [];
    this.group = new THREE.Group();
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(color, 0, dist, 1.6); this.group.add(l); this.lights.push(l); }
    this.events = [];
  }
  add(x, y, z, t0, dur = 0.5, power = 3000, color) { this.events.push({ x, y, z, t0, dur, power, color }); }
  update(T) {
    const act = [];
    for (const e of this.events) { if (T >= e.t0 && T <= e.t0 + e.dur) act.push(e); }
    act.sort((a, b) => b.power - a.power);
    this.lights.forEach((l, i) => {
      const e = act[i];
      if (!e) { l.intensity = 0; return; }
      const u = (T - e.t0) / e.dur;
      l.position.set(e.x, e.y, e.z); l.intensity = e.power * Math.pow(1 - u, 2) * (0.7 + 0.3 * Math.sin(T * 60));
      if (e.color != null) l.color.set(e.color);
    });
  }
}
