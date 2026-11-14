import * as THREE from 'three';
const M = c => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
const mesh = (g, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, M(c)); m.position.set(x, y, z); return m; };
const pick = a => a[Math.random() * a.length | 0];
const G = (...c) => { const g = new THREE.Group(); g.add(...c); return g; };
const S = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const rnd = () => new THREE.Color().setHSL(Math.random(), .7, .5).getHex();

const book = () => G(mesh(new THREE.BoxGeometry(1, 1.3, .25), rnd()), mesh(new THREE.BoxGeometry(.92, 1.2, .2), 0xf5f5f0, .05, 0, 0));
const pen = () => { const g = G(mesh(new THREE.CylinderGeometry(.06, .06, 1.4, 10), rnd()), mesh(new THREE.ConeGeometry(.06, .25, 10), 0x222222, 0, -.82, 0)); g.rotation.z = 1; return g; };
const fish = () => { const b = mesh(S(.5), pick([0xff8a3d, 0x3da5ff, 0xffd43b])); b.scale.set(1.2, .6, .4);
  const tail = mesh(new THREE.ConeGeometry(.3, .5, 8), 0xff6b6b, -.75, 0, 0); tail.rotation.z = Math.PI / 2;
  return G(b, tail, mesh(S(.07, 6, 6), 0x000000, .45, .1, .18)); };
const jelly = () => G(mesh(new THREE.SphereGeometry(.5, 14, 8, 0, 6.3, 0, 1.6), 0xe58cff), ...[-.25, 0, .25].map(x => mesh(new THREE.CylinderGeometry(.03, .03, .7, 5), 0xd070ee, x, -.35, 0)));
const fruit = () => pick([
  () => G(mesh(S(.5), 0xe03131), mesh(new THREE.CylinderGeometry(.03, .03, .25, 6), 0x5c3b1e, 0, .55, 0)),
  () => mesh(S(.5), 0xff9f1c),
  () => mesh(new THREE.TorusGeometry(.5, .13, 8, 16, 3.4), 0xffe14d),
  () => mesh(S(.6), 0x2f9e44)
])();
const veg = () => pick([
  () => G(mesh(new THREE.ConeGeometry(.2, 1.2, 8), 0xff7b00).rotateX(Math.PI), mesh(new THREE.ConeGeometry(.15, .3, 6), 0x2f9e44, 0, .7, 0)),
  () => { const e = mesh(S(.5), 0x6741d9); e.scale.set(.6, 1.1, .6); return e; },
  () => G(mesh(new THREE.CylinderGeometry(.12, .15, .6, 8), 0x8ce99a, 0, -.3, 0), mesh(S(.5), 0x2b8a3e, 0, .2, 0)),
  () => mesh(S(.5), 0xff6b6b)
])();
const tool = () => pick([
  () => G(mesh(new THREE.CylinderGeometry(.07, .07, 1.3, 8), 0x8b5a2b), mesh(new THREE.BoxGeometry(.7, .3, .3), 0x868e96, 0, .65, 0)),
  () => G(mesh(new THREE.CylinderGeometry(.12, .12, .5, 8), 0xe03131, 0, -.5, 0), mesh(new THREE.CylinderGeometry(.04, .04, .9, 8), 0xadb5bd, 0, .2, 0)),
  () => G(mesh(new THREE.BoxGeometry(.12, 1.3, .1), 0xe03131).rotateZ(.2), mesh(new THREE.BoxGeometry(.12, 1.3, .1), 0xe03131).rotateZ(-.2))
])();

export const customImgs = [];
export function addCustom(url) {
  return new Promise(res => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; customImgs.push({ t, a: t.image.width / t.image.height }); res(); }, undefined, () => res()));
}
const custom = () => {
  const { t, a } = pick(customImgs);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5 * Math.min(a, 1.6), 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }));
  return m;
};

export const THEMES = {
  buku:   { name: 'Buku', icon: '📚', build: book },
  pulpen: { name: 'Pulpen', icon: '🖊️', build: pen },
  laut:   { name: 'Hewan Laut', icon: '🐟', build: () => pick([fish, fish, jelly])() },
  buah:   { name: 'Buah', icon: '🍎', build: fruit },
  sayur:  { name: 'Sayur', icon: '🥕', build: veg },
  alat:   { name: 'Martil/Tang/Obeng', icon: '🔨', build: tool },
  campur: { name: 'Campur', icon: '🎲', build: () => pick([book, pen, fish, fruit, veg, tool])() },
  custom: { name: 'Gambar Saya', icon: '🖼️', flat: true, build: custom }
};
