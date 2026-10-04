import * as THREE from 'three';
import { buildBody, torsoKeys, prof, torsoSurf, DIM } from './body.js';
import { buildHead, HEAD } from './head.js';
import { merge, hexRGB, paint, xf, boxG, cylG, sphereG, loft } from './geo.js';
import { CAPE_PROFILES } from './costume.js';

const TAU = Math.PI * 2;
const gcache = new Map();
const MAT = {};
function mats() {
  if (MAT.ready) return MAT;
  MAT.ready = true;
  return MAT;
}
const mk = (props) => new THREE.MeshStandardMaterial({ vertexColors: true, ...props });

function geomFor(o) {
  const key = o.key || JSON.stringify(Object.keys(o).filter((k) => typeof o[k] !== 'function').map((k) => [k, o[k]]));
  if (gcache.has(key)) return gcache.get(key);
  const sp = { ...o, skin: hexRGB(o.skin ?? 0xe3b496), suit: hexRGB(o.suit ?? 0x2a3a66), pants: hexRGB(o.suit2 ?? o.suit ?? 0x222a44), sleeve: hexRGB(o.sleeve ?? o.suit ?? 0x2a3a66), fore: o.forearm != null ? hexRGB(o.forearm) : null, boot: hexRGB(o.boots ?? 0x222222), glove: o.gloves != null ? hexRGB(o.gloves) : null, hair: hexRGB(o.hair ?? 0x3a2a1a), shin: o.shin != null ? hexRGB(o.shin) : null };
  if (sp.fore == null) delete sp.fore;
  if (sp.mask != null) sp.mask = hexRGB(sp.mask);
  if (sp.helmet != null) sp.helmet = hexRGB(sp.helmet);
  if (o.beardColor != null) sp.beardColor = hexRGB(o.beardColor);
  if (o.iris != null) sp.iris = hexRGB(o.iris);
  const body = buildBody(sp);
  const head = buildHead(sp);
  const extra = {};
  if (o.extra) o.extra({ sp, add: (bone, kind, g) => { ((extra[bone] = extra[bone] || {})[kind] = extra[bone][kind] || []).push(g); }, T: (y, a) => torsoSurf(sp, y, a), prof, torsoKeys });
  const out = { sp, body, head, extra };
  gcache.set(key, out); return out;
}

export class Human {
  constructor(o = {}) {
    this.o = o; this.key = o.speakKey || null;
    const G = geomFor(o); this.G = G; const sp = G.sp;
    const s = (o.scale || 1) * 0.95;
    this.group = new THREE.Group(); this.body = new THREE.Group(); this.body.scale.setScalar(s); this.group.add(this.body);
    const mk2 = (p) => mk(p);
    const sk = mk2({ roughness: 0.78, metalness: 0.0 });
    const suit = mk2({ roughness: 0.52, metalness: o.metal ?? 0.12 });
    const metal = mk2({ roughness: 0.42, metalness: 0.55 });
    const hairM = mk2({ roughness: 0.55, metalness: 0.05 });
    const dark = mk2({ roughness: 0.9, metalness: 0.0 });
    this.mats = { sk, suit, suit2: suit, slv: suit, boots: suit, gloves: suit, hair: hairM, metal };
    const kinds = { skin: sk, cloth: suit, metal, dark, hair: hairM };
    const b = o.bulk || 1, f = o.fem ? 1 : 0;
    const mkBone = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); this[name] = g; return g; };
    const mesh = (parent, geo, mat) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
    this.root = mkBone('root', this.body, 0, 0.97, 0);
    this.spine = mkBone('spine', this.root, 0, DIM.SPINE_Y, 0);
    this.neck = mkBone('neck', this.spine, 0, DIM.NECK_Y, 0);
    this.head = mkBone('head', this.neck, 0, 0.08, 0);
    const shx = prof(torsoKeys(sp), 0.5).rx + 0.046;
    const hx = 0.086 * b + 0.012 * f;
    const bones = { root: this.root, spine: this.spine, neck: this.neck };
    for (const sx of [1, -1]) {
      const S = sx > 0 ? 'L' : 'R';
      const sh = mkBone('sh' + S, this.spine, sx * shx, DIM.SH_Y, 0); const el = mkBone('el' + S, sh, 0, -DIM.ELBOW, 0);
      const hp = mkBone('hp' + S, this.root, sx * hx, DIM.HIP_Y, 0); const kn = mkBone('kn' + S, hp, 0, -DIM.KNEE, 0);
      bones['sh' + S] = sh; bones['el' + S] = el; bones['hp' + S] = hp; bones['kn' + S] = kn;
    }
    // body parts: each bone merges its geometry per material kind
    const place = (src) => { for (const bn in src) for (const kind in src[bn]) { const geo = merge(src[bn][kind]); const parent = bones[bn]; if (geo && parent) mesh(parent, geo, kinds[kind]); } };
    place(G.body); place(G.extra);
    // head
    const H = G.head;
    mesh(this.head, H.skin, sk); H.hair && mesh(this.head, H.hair, hairM); H.beard && mesh(this.head, H.beard, hairM);
    H.cloth && mesh(this.head, H.cloth, suit); H.metal && mesh(this.head, H.metal, metal); H.dark && mesh(this.head, H.dark, dark);
    this.eyeMeshes = H.eyeGeo.map((g) => mesh(this.head, g, mk2({ roughness: 0.18, metalness: 0.0 })));
    this.eyes = H.eyes.map((e) => { const m = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a10 })); m.scale.z = 0.55; m.position.set(e.x, e.y, e.z + e.r * 0.62); m.visible = false; this.head.add(m); return m; });
    // brows
    this.brows = H.brows.map((b2) => { const piv = new THREE.Group(); piv.position.set(b2.x, b2.y, b2.z); this.head.add(piv); const m = new THREE.Mesh(b2.geo, hairM); b2.geo.translate(0, 0, 0); piv.add(m); piv.userData.sx = b2.sx; return piv; });
    // dynamic mouth
    this._mouth(H.mouth, sk);
    // cape
    if (o.cape != null) this._cape(o, sp);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
    this.shadow.scale.setScalar(0.5 * s); this.shadow.position.y = 0.03; this.shadow.renderOrder = 1; this.group.add(this.shadow);
    this.gun = null; if (o.gun) { this.gun = this._gun(); this.elR.add(this.gun); }
    this._smile = 0.12; this._open = 0; this._ml = -1; this._phase = Math.random() * 6;
    this.pose(POSE0); this.face(0.12);
  }
  _mouth(m, sk) {
    this.mouthInfo = m; const N = 19, rows = 9;
    const pos = new Float32Array(N * rows * 3), col = new Float32Array(N * rows * 3), idx = [];
    const lip = m.lip, lipD = [lip[0] * 0.8, lip[1] * 0.75, lip[2] * 0.75];
    // rows: 0 upper top, 1 upper mid, 2 upper line, 3 inner-up(dark), 4 teeth, 5 inner-low(dark), 6 lower line, 7 lower mid, 8 lower bottom
    const rc = [lip, lip, lipD, [0.12, 0.04, 0.04], [0.9, 0.88, 0.82], [0.12, 0.04, 0.04], lipD, lip, lip];
    for (let r = 0; r < rows; r++) for (let k = 0; k < N; k++) { const i = r * N + k; col[i * 3] = rc[r][0]; col[i * 3 + 1] = rc[r][1]; col[i * 3 + 2] = rc[r][2]; }
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < N - 1; k++) { const a = r * N + k, b = a + 1, c = a + N, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.mouthGeo = g; this.mouthMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide })); this.head.add(this.mouthMesh);
    this.mouthMesh.frustumCulled = false;
  }
  _updateMouth(smile, open) {
    const m = this.mouthInfo, g = this.mouthGeo, P = g.attributes.position, N = 19; const w = m.halfW, y0 = m.y, z0 = m.z;
    const full = 0.0032 + 0.003 * m.fullness;
    for (let k = 0; k < N; k++) {
      const u = (k / (N - 1)) * 2 - 1; const x = u * w; const e = Math.abs(u);
      const lift = smile * 0.0075 * Math.pow(e, 2.2) - (smile < 0 ? 0.0 : 0) ;
      const narrow = 1 - 0.1 * Math.max(0, -smile) * e;
      const cup = 0.0035 * Math.exp(-((u - 0.0) ** 2) / 0.1) + 0.0016 * (Math.exp(-((u - 0.42) ** 2) / 0.04) + Math.exp(-((u + 0.42) ** 2) / 0.04));
      const zc = z0 - 8 * x * x * narrow * narrow;
      const yl = y0 + lift;                        // lip line at corners
      const lineUp = yl - open * 0.002 * (1 - e * e);
      const lineLow = yl - open * 0.017 * (1 - 0.5 * e * e);
      const pr = full * (1 - e * e * 0.7) + 0.0015;
      const set = (r, y, z) => P.setXYZ(r * N + k, x * narrow, y, z);
      set(0, lineUp + cup + full * 0.55, zc + pr * 0.55);
      set(1, lineUp + cup * 0.35 + full * 0.18, zc + pr);
      set(2, lineUp, zc + pr * 0.5);
      set(3, lineUp - 0.0004, zc - 0.0035);
      set(4, lineUp - open * 0.0016 - 0.0005, zc - 0.0042);
      set(5, lineLow + 0.0004, zc - 0.0035);
      set(6, lineLow, zc + pr * 0.55);
      set(7, lineLow - full * 0.75, zc + pr * 1.05);
      set(8, lineLow - full * 1.55 - 0.0015 * (1 - e), zc + pr * 0.35);
    }
    P.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }
  _cape(o, sp) {
    const prof2 = CAPE_PROFILES[o.capeStyle || 'hero'];
    const w = prof2.w, hgt = o.capeLen || prof2.len, sx = 8, sy = 16;
    const mkGeo = () => new THREE.PlaneGeometry(w, hgt, sx, sy);
    this.capeGeo = mkGeo(); this.capeBase = this.capeGeo.attributes.position.array.slice();
    const outer = new THREE.MeshStandardMaterial({ color: o.cape, side: THREE.FrontSide, roughness: 0.62, metalness: 0.05 });
    const inner = new THREE.MeshStandardMaterial({ color: o.capeInner ?? 0xe8e4dc, side: THREE.BackSide, roughness: 0.7 });
    this.capeMesh = new THREE.Mesh(this.capeGeo, outer); this.capeMesh.frustumCulled = false; this.spine.add(this.capeMesh);
    this.capeIn = new THREE.Mesh(this.capeGeo, inner); this.capeIn.frustumCulled = false; this.spine.add(this.capeIn);
    this.capeLen = hgt; this.capeW = w; this.capeSX = sx; this.capeSY = sy; this.capeZ = prof2.z; this.capeY = prof2.y; this.updateCape(0, 0);
  }
  updateCape(t, flow = 0, wind = 1) {
    if (!this.capeMesh) return;
    const pa = this.capeGeo.attributes.position, cols = this.capeSX + 1; const W = this.capeW, Lc = this.capeLen;
    for (let i = 0; i < pa.count; i++) {
      const row = (i / cols) | 0, col = i % cols; const v = row / this.capeSY, u = col / this.capeSX - 0.5;
      const L = v * Lc;
      const gather = 1 - 0.5 * Math.exp(-v * 7) * (1 - Math.abs(u) * 0.2);   // narrower at shoulders
      const wave = Math.sin(t * 5.2 + v * 7 + u * 3.4) * (0.012 + 0.2 * v * v) * wind + Math.sin(t * 11 + v * 12 + u * 5) * 0.028 * v * flow;
      const fold = Math.sin(u * 14 + v * 2.0) * 0.018 * v * (1 - flow * 0.5);
      const spread = (1 + v * (0.30 + 0.62 * flow)) * (0.55 + 0.45 * gather);
      const ang = flow * 1.35 * Math.min(1, v * 1.6 + 0.2);
      const x = u * W * spread + wave * 0.6 * (1 + flow) * (u + 0.2);
      const y = this.capeY - L * Math.cos(flow * 0.35 * (1 + v));
      const z = this.capeZ - L * Math.sin(Math.min(ang, 1.5)) * 0.9 - Math.abs(wave) * 0.25 - v * 0.05 + fold;
      pa.setXYZ(i, x, y, z);
    }
    pa.needsUpdate = true; this.capeGeo.computeVertexNormals();
  }
  _gun() {
    const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.5, metalness: 0.6 }); const m2 = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.7 });
    const add = (geo, mat, x, y, z, rx = 0) => { const q = new THREE.Mesh(geo, mat); q.position.set(x, y, z); q.rotation.x = rx; g.add(q); return q; };
    add(new THREE.BoxGeometry(0.045, 0.075, 0.30), m, 0, -0.31, 0.12); add(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 8), m, 0, -0.30, 0.46, Math.PI / 2);
    add(new THREE.BoxGeometry(0.04, 0.09, 0.2), m2, 0, -0.32, -0.12); add(new THREE.BoxGeometry(0.03, 0.12, 0.05), m, 0, -0.38, 0.14, 0.2); add(new THREE.BoxGeometry(0.03, 0.03, 0.09), m, 0, -0.26, 0.15);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffcc66, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); this.flash.scale.set(0.7, 0.7, 1); this.flash.position.set(0, -0.3, 0.68); g.add(this.flash);
    return g;
  }
  pose(p) {
    const Pk = (k) => p[k] || 0;
    this.root.position.y = 0.97 + Pk('ry');
    this.root.rotation.set(Pk('rx'), Pk('ryaw'), Pk('rz'));
    this.spine.rotation.set(Pk('sx'), Pk('sy'), Pk('sz'));
    this.head.rotation.set(Pk('hx'), Pk('hy'), Pk('hz'));
    this.shL.rotation.set(-Pk('lax'), Pk('lay'), Pk('laz'));
    this.shR.rotation.set(-Pk('rax'), Pk('ray'), -Pk('raz'));
    this.elL.rotation.set(-Pk('le'), 0, 0); this.elR.rotation.set(-Pk('re'), 0, 0);
    this.hpL.rotation.set(-Pk('llh'), 0, Pk('llz')); this.hpR.rotation.set(-Pk('rlh'), 0, -Pk('rlz'));
    this.knL.rotation.set(Pk('lk'), 0, 0); this.knR.rotation.set(Pk('rk'), 0, 0);
    // lip-sync from whoever is speaking right now
    const t = Human.T || 0;
    const talking = this.key && Human.talk && Human.talk.has(this.key);
    const open = talking ? Math.max(0, 0.18 + 0.5 * Math.abs(Math.sin(t * 12 + this._phase)) * (0.6 + 0.4 * Math.sin(t * 3.1 + this._phase))) : 0;
    this._setOpen(open);
  }
  _setOpen(o) { const q = Math.round(o * 12) / 12; if (q !== this._open) { this._open = q; this._ml = -1; } this._refresh(); }
  _refresh() { const key = this._smile * 100 + this._open * 7; if (key !== this._ml) { this._ml = key; this._updateMouth(this._smile, this._open); } }
  place(x, y, z, ry = 0) {
    this.group.position.set(x, y, z); this.group.rotation.y = ry;
    this.shadow.visible = y < 2.5; this.shadow.position.y = 0.03 - y; return this;
  }
  face(smile = 0.5) { // -1 furious/grim .. 1 big smile
    smile = Math.max(-1, Math.min(1, smile)); this._smile = Math.round(smile * 40) / 40;
    const ang = Math.max(0, -smile), sad = 0;
    this.brows.forEach((pv) => { const sx = pv.userData.sx; pv.rotation.z = sx * ang * 0.36 - sx * Math.max(0, smile) * 0.06; pv.position.y = this.G.head.brows[0].y - ang * 0.0035 + Math.max(0, smile) * 0.0015; });
    this._refresh();
  }
  heat(on) { this.eyes.forEach((e) => (e.visible = on)); }
  look(visible) { this.group.visible = visible; }
}
Human.T = 0; Human.talk = new Set();

const sin = Math.sin, cos = Math.cos;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const POSE_KEYS = ['ry', 'rx', 'rz', 'ryaw', 'sx', 'sy', 'sz', 'hx', 'hy', 'hz', 'lax', 'laz', 'lay', 'le', 'rax', 'raz', 'ray', 're', 'llh', 'llz', 'lk', 'rlh', 'rlz', 'rk'];
export const POSE0 = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));
