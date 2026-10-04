import * as THREE from 'three';
import { Strider } from '/home/user/Homelander-Film/src/model/creatures.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, createLinearGradient: () => ({ addColorStop() {} }) }), width: 0, height: 0 }) };
const s = new Strider();
s.g.updateMatrixWorld(true);
const bb = (o, n) => { const b = new THREE.Box3().setFromObject(o); console.log(n, b.min.toArray().map((v) => v.toFixed(1)).join(','), '->', b.max.toArray().map((v) => v.toFixed(1)).join(',')); };
bb(s.body.children[0], 'hull'); bb(s.head, 'head'); bb(s.legs[0].up, 'upper0'); bb(s.legs[0].lo, 'lower0');
