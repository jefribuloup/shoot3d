import * as THREE from 'three';
// Model objek prosedural (tanpa file aset): geometri lathe/extrude/tube + tekstur kanvas. Dibuat sekali lalu di-clone oleh main.js.
const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const pick = a => a[Math.random() * a.length | 0], rr = (a, b) => a + Math.random() * (b - a);
const shade = (c, k = 1) => '#' + [16, 8, 0].map(s => Math.min(255, ((c >> s & 255) * k) | 0).toString(16).padStart(2, '0')).join('');
const memo = {}, once = (k, f) => memo[k] || (memo[k] = f());
function tex(key, w, h, draw, rep) {
  return once('t' + key, () => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); if (!g) return null;
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  });
}
const noise = (g, w, h, n, a = .06, dark = true) => { for (let i = 0; i < n; i++) { g.fillStyle = dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
const mat = (c, o = {}, tint) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: .6, metalness: 0, ...o }); m.userData.c = tint ?? c; return m; };
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const prof = (pts, seg = 32, n = 36) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(p => V2(p[0], p[1]))).getPoints(n).map(p => V2(Math.max(0, p.x), p.y)), seg);
const place = (g, p = [0, 0, 0], r = [0, 0, 0], s = 1) => g.applyMatrix4(new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), Array.isArray(s) ? V3(...s) : V3(s, s, s)));
const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), k = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
function merge(list) {
  const gs = list.map(g => g.index ? g.toNonIndexed() : g), out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) {
    if (!gs[0].attributes[k]) continue;
    const arr = new Float32Array(gs.reduce((a, g) => a + g.attributes[k].array.length, 0)); let o = 0;
    for (const g of gs) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, gs[0].attributes[k].itemSize));
  }
  return out;
}
const group = (...c) => { const g = new THREE.Group(); g.add(...c); return g; };
function fit(g, size = 1.4) { // pusatkan & normalkan ukuran supaya semua objek punya hitbox yang sama
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(V3(0, 0, 0)), s = b.getSize(V3(0, 0, 0));
  g.position.sub(c); const w = new THREE.Group(); w.add(g); w.scale.setScalar(size / Math.max(s.x, s.y, s.z, .001));
  const o = new THREE.Group(); o.add(w); return o;
}
const stem = (pts, r, c) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), 8, r, 6), mat(c, { roughness: .8 }));
function calyx(n, y, len, col) { // daun kelopak berbentuk bintang (stroberi/tomat)
  const geo = new THREE.ConeGeometry(.07, len, 4).rotateZ(-Math.PI / 2).scale(1, .22, 1).translate(len / 2, 0, 0), m = mat(col, { roughness: .6 }), g = new THREE.Group();
  for (let i = 0; i < n; i++) { const l = new THREE.Mesh(geo, m); l.position.y = y; l.rotation.set(0, i / n * Math.PI * 2, -.3); g.add(l); } return g;
}

// ================= BUAH =================
function apple() {
  const col = pick([0xd62828, 0xc1121f, 0x8cc63f, 0xe9b44c]);
  const t = tex('apple' + col, 128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, shade(col, .65)); gr.addColorStop(.45, shade(col, 1.05)); gr.addColorStop(1, shade(col, .7)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = Math.random() < .5 ? 'rgba(255,225,120,.22)' : 'rgba(60,0,0,.18)'; g.lineWidth = rr(1, 3); const x = Math.random() * w; g.beginPath(); g.moveTo(x, rr(0, h * .4)); g.lineTo(x + rr(-4, 4), rr(h * .6, h)); g.stroke(); }
    noise(g, w, h, 500, .08, false);
  });
  const body = mesh(prof([[0, -.45], [.2, -.5], [.42, -.42], [.55, -.25], [.58, 0], [.52, .25], [.38, .42], [.17, .45], [.06, .38], [0, .33]], 36, 32), mat(0xffffff, { map: t, roughness: .3 }, col));
  const leaf = mesh(new THREE.SphereGeometry(.13, 10, 6).scale(1.7, .12, .8), mat(0x3a8a2e, { roughness: .6 }), .14, .5, 0); leaf.rotation.z = .35;
  return fit(group(body, stem([[0, .3, 0], [.01, .5, 0], [.05, .66, 0]], .022, 0x5a3a1e), leaf));
}
function orange() {
  const bump = tex('bump', 128, 128, (g, w, h) => { g.fillStyle = '#888'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { g.fillStyle = `hsl(0,0%,${rr(30, 85)}%)`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }, [3, 2]);
  const col = pick([0xff8c1a, 0xff9f1c, 0xf77f00]);
  const body = mesh(prof([[0, -.44], [.3, -.42], [.46, -.25], [.5, 0], [.46, .25], [.3, .42], [.1, .45], [0, .43]], 36, 28), mat(col, { roughness: .55, ...(bump ? { bumpMap: bump, bumpScale: 2 } : {}) }));
  return fit(group(body, mesh(new THREE.SphereGeometry(.07, 8, 6).scale(1, .35, 1), mat(0x3d7a2a), 0, .44, 0), stem([[0, .44, 0], [.01, .5, 0]], .02, 0x4a6b2a)));
}
function banana() {
  const N = 30, MR = 20, R = 1.15, pts = [];
  for (let i = 0; i <= 10; i++) { const a = -.9 + i * .18; pts.push(V3(R * Math.sin(a), -R * Math.cos(a), 0)); }
  const curve = new THREE.CatmullRomCurve3(pts), fr = curve.computeFrenetFrames(N, false), pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), nn = fr.normals[i], bb = fr.binormals[i];
    const k = Math.min(1, Math.min(t, 1 - t) / .16), r = .17 * (.32 + .68 * Math.sin(k * Math.PI / 2)) * (t > .94 ? 1 - (t - .94) / .06 * .75 : 1);
    for (let j = 0; j <= MR; j++) { const th = j / MR * Math.PI * 2, f = r * (1 + .1 * Math.cos(5 * th)), c = Math.cos(th) * f, s = Math.sin(th) * f;
      pos.push(p.x + nn.x * c + bb.x * s, p.y + nn.y * c + bb.y * s, p.z + nn.z * c + bb.z * s); uv.push(j / MR, t); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < MR; j++) { const a = i * (MR + 1) + j, b = a + MR + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const t = tex('banana', 64, 256, (g, w, h) => {
    g.fillStyle = '#f2cf3a'; g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, h, 0, h * .8); gr.addColorStop(0, '#7f9a2a'); gr.addColorStop(1, 'rgba(242,207,58,0)'); g.fillStyle = gr; g.fillRect(0, h * .8, w, h * .2);
    gr = g.createLinearGradient(0, 0, 0, h * .08); gr.addColorStop(0, '#2b1d0e'); gr.addColorStop(1, 'rgba(60,40,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h * .08);
    g.strokeStyle = 'rgba(150,105,20,.55)'; g.lineWidth = 1.5; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(k / 5 * w, h * .1); g.lineTo(k / 5 * w, h * .86); g.stroke(); }
    for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(110,70,15,${rr(.2, .6)})`; g.beginPath(); g.arc(Math.random() * w, rr(h * .1, h * .88), rr(.6, 1.8), 0, 7); g.fill(); }
  });
  const body = mesh(geo, mat(pick([0xffffff, 0xf0ffd0]), { map: t, roughness: .5, side: THREE.DoubleSide }, 0xf2cf3a));
  const a = curve.getPointAt(0), d0 = curve.getTangentAt(0).negate(), b = curve.getPointAt(1);
  const st = mesh(new THREE.CylinderGeometry(.05, .06, .22, 8), mat(0x7a8a2e, { roughness: .8 })); st.position.copy(a).addScaledVector(d0, .1); st.quaternion.setFromUnitVectors(V3(0, 1, 0), d0);
  return fit(group(body, st, mesh(new THREE.SphereGeometry(.035, 8, 6), mat(0x2b1d0e), b.x, b.y, b.z)));
}
function watermelon() {
  const t = tex('melon', 128, 256, (g, w, h) => {
    g.fillStyle = '#4c9a3a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 9; k++) { g.strokeStyle = k % 2 ? '#1e5e24' : '#2d7a2e'; g.lineWidth = w / 12; g.beginPath(); for (let y = 0; y <= h; y += 8) { const x = k / 9 * w + Math.sin(y / h * 12 + k) * 5; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    noise(g, w, h, 600, .07);
  });
  const body = mesh(prof([[0, -.7], [.3, -.66], [.5, -.45], [.6, -.1], [.6, .2], [.5, .5], [.28, .68], [0, .72]], 36, 32), mat(0xffffff, { map: t, roughness: .35 }, 0x2d7a2e));
  return fit(group(body, stem([[0, .7, 0], [.02, .8, 0], [.07, .88, 0]], .03, 0x5b6b2a)));
}
function strawberry() {
  const t = tex('straw', 128, 128, (g, w, h) => {
    g.fillStyle = '#d8223a'; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 14) for (let x = (y / 14 % 2) * 8; x < w; x += 16) { g.fillStyle = '#f5d76e'; g.beginPath(); g.ellipse(x, y, 1.8, 2.8, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(80,0,10,.25)'; g.beginPath(); g.arc(x, y + 1, 4, 0, 7); g.fill(); }
  });
  return fit(group(mesh(prof([[0, -.55], [.14, -.5], [.31, -.33], [.41, -.05], [.42, .15], [.34, .3], [.18, .38], [0, .4]], 28, 26), mat(0xffffff, { map: t, roughness: .35 }, 0xd8223a)), calyx(7, .38, .3, 0x3c8f3a), stem([[0, .38, 0], [0, .52, 0]], .025, 0x4c8a2c)));
}
// ================= SAYUR =================
function carrot() {
  const t = tex('carrot', 64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff8a1f'); gr.addColorStop(1, '#e8620a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 28; i++) { g.strokeStyle = 'rgba(120,50,0,.28)'; g.lineWidth = rr(1, 2); const y = Math.random() * h; g.beginPath(); g.moveTo(Math.random() * 20, y); g.lineTo(rr(30, w), y + rr(-2, 2)); g.stroke(); }
  });
  const body = mesh(prof([[0, -.78], [.03, -.7], [.09, -.4], [.16, 0], [.21, .35], [.22, .58], [0, .6]], 24, 28), mat(0xffffff, { map: t, roughness: .65 }, 0xff7a18));
  const leaves = []; for (let i = 0; i < 6; i++) leaves.push(place(new THREE.ConeGeometry(.045, .6, 5).translate(0, .3, 0), [0, .58, 0], [rr(-.5, .5), i, rr(-.5, .5)]));
  return fit(group(body, mesh(merge(leaves), mat(0x3f9a35, { roughness: .7 }))));
}
function eggplant() {
  const body = mesh(prof([[0, -.58], [.2, -.55], [.38, -.38], [.46, -.1], [.4, .2], [.28, .43], [.17, .56], [.14, .64], [0, .66]], 32, 32), mat(0x3d1459, { roughness: .18 }));
  const cap = mesh(new THREE.SphereGeometry(.24, 14, 8, 0, 6.3, 0, 1.25).scale(1, .6, 1), mat(0x4f8f3b, { roughness: .7 }), 0, .58, 0);
  return fit(group(body, cap, calyx(6, .6, .3, 0x4f8f3b), stem([[0, .66, 0], [.03, .86, 0], [.12, .98, 0]], .045, 0x5a8a35)));
}
function broccoli() {
  const base = new THREE.IcosahedronGeometry(1, 2), p = base.attributes.position;
  const bumpy = () => { const g = base.clone(), q = g.attributes.position; for (let i = 0; i < q.count; i++) { const k = 1 + rr(-.1, .12); q.setXYZ(i, q.getX(i) * k, q.getY(i) * k, q.getZ(i) * k); } g.computeVertexNormals(); return g; }, vars = [bumpy(), bumpy(), bumpy()];
  const fl = [], n = 20;
  for (let i = 0; i < n; i++) { const y = 1 - (i + .5) / n * .75, rad = Math.sqrt(1 - y * y), a = i * 2.39996, s = rr(.2, .27), g = vars[i % 3].clone();
    place(g, [Math.cos(a) * rad * .5, y * .42 + .38, Math.sin(a) * rad * .5], [0, 0, 0], s); fl.push(paint(g, pick([0x2f7d32, 0x2a6e2e, 0x3b8f3a, 0x246a2b]))); }
  const trunk = mesh(prof([[0, -.75], [.1, -.73], [.13, -.5], [.15, -.2], [.2, 0], [.2, .1], [0, .12]], 14, 18), mat(0x9ccf6a, { roughness: .8 }));
  const br = []; for (let i = 0; i < 5; i++) br.push(place(new THREE.CylinderGeometry(.03, .06, .4, 6).translate(0, .2, 0), [0, 0, 0], [Math.cos(i * 1.26) * .6, 0, Math.sin(i * 1.26) * .6]));
  return fit(group(trunk, mesh(merge(br), mat(0x8dc15d, { roughness: .8 })), mesh(merge(fl), mat(0xffffff, { vertexColors: true, roughness: .9 }, 0x2f7d32))));
}
function tomato() {
  return fit(group(mesh(prof([[0, -.4], [.25, -.38], [.46, -.22], [.52, 0], [.46, .22], [.28, .36], [.1, .33], [0, .28]], 36, 28), mat(0xe0242f, { roughness: .22 })), calyx(5, .33, .3, 0x3f8f3a), stem([[0, .3, 0], [0, .42, 0], [.04, .5, 0]], .025, 0x4c8a2c)));
}
// ================= HEWAN LAUT =================
function fish() {
  const [c1, c2] = pick([[0xff7a14, 0xffffff], [0x2f80ed, 0xffd43b], [0xf2c94c, 0x2d9cdb], [0xe0457b, 0xfff1c9]]);
  const t = tex('fish' + c1, 128, 128, (g, w, h) => {
    g.fillStyle = shade(c1); g.fillRect(0, 0, w, h);
    let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,.05)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(.75, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,.05)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = shade(c2); for (const y of [.3, .55, .78]) { g.fillRect(0, h * y, w, h * .07); }
    g.strokeStyle = 'rgba(0,0,0,.22)'; for (let y = 4; y < h; y += 7) for (let x = (y / 7 % 2) * 6; x < w; x += 12) { g.beginPath(); g.arc(x, y, 6, 0, Math.PI); g.stroke(); }
  });
  const bodyGeo = prof([[0, -.62], [.05, -.6], [.12, -.45], [.2, -.2], [.27, .05], [.3, .2], [.25, .38], [.14, .52], [.05, .6], [0, .62]], 32, 30).rotateZ(-Math.PI / 2).scale(1, 1.15, .55);
  const body = mesh(bodyGeo, mat(0xffffff, { map: t, roughness: .3, metalness: .15 }, c1));
  const sh = (f) => { const s = new THREE.Shape(); f(s); return new THREE.ShapeGeometry(s, 8); };
  const fins = merge([
    sh(s => { s.moveTo(-.28, .24); s.bezierCurveTo(-.22, .6, .05, .62, .22, .27); s.closePath(); }),
    sh(s => { s.moveTo(-.55, 0); s.lineTo(-.98, .34); s.quadraticCurveTo(-.84, 0, -.98, -.34); s.closePath(); }),
    sh(s => { s.moveTo(-.1, -.27); s.lineTo(-.28, -.48); s.lineTo(.1, -.3); s.closePath(); }),
    place(sh(s => { s.moveTo(0, 0); s.quadraticCurveTo(-.12, -.12, -.2, -.26); s.quadraticCurveTo(.0, -.2, .08, -.04); s.closePath(); }), [.2, -.06, .15]),
    place(sh(s => { s.moveTo(0, 0); s.quadraticCurveTo(-.12, -.12, -.2, -.26); s.quadraticCurveTo(.0, -.2, .08, -.04); s.closePath(); }), [.2, -.06, -.15])]);
  const fm = mat(c2, { roughness: .5, transparent: true, opacity: .9, side: THREE.DoubleSide }, c1);
  const eyeW = new THREE.SphereGeometry(.065, 10, 8), eyeB = new THREE.SphereGeometry(.036, 8, 6), ew = mat(0xffffff, { roughness: .2 }), eb = mat(0x050505, { roughness: .1 });
  return fit(group(body, mesh(fins, fm), mesh(eyeW, ew, .4, .09, .15), mesh(eyeW, ew, .4, .09, -.15), mesh(eyeB, eb, .43, .09, .185), mesh(eyeB, eb, .43, .09, -.185)));
}
function jelly() {
  const col = pick([0xff8fd8, 0x8fe3ff, 0xb59cff]), bg = prof([[0, .5], [.2, .46], [.4, .32], [.52, .1], [.55, -.05], [.5, -.1], [.42, -.04], [.3, 0], [.15, .05], [0, .06]], 36, 30), q = bg.attributes.position;
  for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i), y = q.getY(i); if (y < .12) { const k = 1 + .05 * Math.cos(10 * Math.atan2(z, x)); q.setX(i, x * k); q.setZ(i, z * k); } } bg.computeVertexNormals();
  const bell = mesh(bg, mat(col, { roughness: .15, transparent: true, opacity: .72, emissive: col, emissiveIntensity: .25, side: THREE.DoubleSide, depthWrite: false }));
  const tube = (r, len, rad, w) => { const pts = []; for (let i = 0; i <= 5; i++) pts.push(V3(Math.cos(r) * rad + Math.sin(i * 1.3 + r * 3) * .05, -.05 - i * len / 5, Math.sin(r) * rad + Math.cos(i * 1.1 + r) * .05)); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, w, 5); };
  const th = [], arms = []; for (let i = 0; i < 12; i++) th.push(tube(i * .52, rr(.6, .95), .42, .014)); for (let i = 0; i < 4; i++) arms.push(tube(i * 1.57 + .4, .5, .12, .035));
  const tm = (o, e) => mat(col, { roughness: .3, transparent: true, opacity: o, emissive: col, emissiveIntensity: e, depthWrite: false });
  return fit(group(bell, mesh(merge(th), tm(.75, .3)), mesh(merge(arms), tm(.85, .35))));
}
// ================= BUKU & PULPEN =================
function book() {
  const col = pick([0xc0392b, 0x2e86c1, 0x1e8449, 0x8e44ad, 0xd68910, 0x1a5276, 0x7b241c]), W = 1, H = 1.4, D = .26;
  const cov = tex('cov' + col, 128, 192, (g, w, h) => {
    g.fillStyle = shade(col); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,215,120,.85)'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16); g.lineWidth = 1; g.strokeRect(13, 13, w - 26, h - 26);
    g.fillStyle = 'rgba(255,240,200,.92)'; g.fillRect(24, 38, w - 48, 36); g.fillStyle = shade(col, .55); g.fillRect(34, 50, w - 68, 6); g.fillRect(46, 61, w - 92, 4);
    g.fillStyle = 'rgba(255,215,120,.9)'; g.beginPath(); g.arc(w / 2, 125, 18, 0, 7); g.fill(); g.fillStyle = shade(col, .8); g.beginPath(); g.arc(w / 2, 125, 10, 0, 7); g.fill(); noise(g, w, h, 500, .06);
  });
  const lines = (v) => tex('pg' + v, 64, 64, (g, w, h) => { g.fillStyle = '#f3eddc'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(120,100,70,.5)'; for (let i = 2; i < 64; i += 3) { g.beginPath(); v ? (g.moveTo(i, 0), g.lineTo(i, h)) : (g.moveTo(0, i), g.lineTo(w, i)); g.stroke(); } });
  const pg = (v) => mat(0xffffff, { map: lines(v), roughness: .9 }, 0xf3eddc), plain = mat(0xf3eddc, { roughness: .9 });
  const pages = new THREE.Mesh(new THREE.BoxGeometry(W * .94, H * .95, D * .84), [pg(1), plain, pg(0), pg(0), plain, plain]); pages.position.x = .03;
  const cm = mat(0xffffff, { map: cov, roughness: .5 }, col), sm = mat(col, { roughness: .5 });
  const front = mesh(new THREE.BoxGeometry(W, H, .035), cm, 0, 0, D / 2), back = mesh(new THREE.BoxGeometry(W, H, .035), sm, 0, 0, -D / 2);
  const spine = mesh(new THREE.CylinderGeometry(D / 2, D / 2, H, 16, 1, true, Math.PI, Math.PI), sm, -W / 2, 0, 0); spine.material.side = THREE.DoubleSide;
  return fit(group(pages, front, back, spine, mesh(new THREE.PlaneGeometry(.04, .35), mat(0xb3202a, { side: THREE.DoubleSide }), .1, -H / 2 - .12, 0)));
}
function pen() {
  const col = pick([0x1f5fbf, 0xc0262d, 0x14171c, 0x1e8449, 0x7d3cc9]), body = mat(col, { roughness: .22, metalness: .1 }), metal = mat(0xd6dade, { metalness: 1, roughness: .22 }, 0xcccccc), rub = mat(0x181a1f, { roughness: .85 });
  const barrel = mesh(prof([[0, -.2], [.058, -.2], [.06, -.15], [.06, .55], [.055, .6], [0, .61]], 20, 12), body);
  const grip = mesh(prof([[0, -.58], [.045, -.57], [.058, -.5], [.062, -.22], [.06, -.19], [0, -.19]], 20, 18), rub);
  const tip = mesh(new THREE.ConeGeometry(.045, .3, 20).rotateX(Math.PI).translate(0, -.72, 0), metal);
  const nib = mesh(new THREE.CylinderGeometry(.006, .006, .05, 6), metal, 0, -.89, 0);
  const clip = mesh(merge([new THREE.BoxGeometry(.014, .5, .03).translate(.075, .3, 0), new THREE.BoxGeometry(.03, .03, .03).translate(.065, .04, 0)]), metal);
  const parts = [barrel, grip, tip, nib, clip, mesh(new THREE.CylinderGeometry(.028, .028, .12, 12), metal, 0, .67, 0), mesh(new THREE.CylinderGeometry(.064, .064, .025, 20), metal, 0, .58, 0)];
  const g = group(...parts); g.rotation.z = 1; return fit(g);
}
// ================= ALAT =================
const woodTex = () => tex('wood', 64, 128, (g, w, h) => { g.fillStyle = '#b57e48'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${rr(70, 120) | 0},${rr(40, 70) | 0},20,${rr(.15, .4)})`; g.lineWidth = rr(.5, 2); g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.bezierCurveTo(x + rr(-6, 6), h * .3, x + rr(-6, 6), h * .6, x + rr(-4, 4), h); g.stroke(); } });
function hammer() {
  const steel = mat(0x9aa1a8, { metalness: 1, roughness: .28 }, 0xaaaaaa);
  const handle = mesh(prof([[0, -.82], [.06, -.8], [.06, -.4], [.05, 0], [.06, .4], [.085, .56], [0, .58]], 18, 20), mat(0xffffff, { map: woodTex(), roughness: .65 }, 0xb57e48));
  const grip = mesh(prof([[0, -.86], [.09, -.84], [.095, -.3], [.082, -.22], [0, -.2]], 18, 14), mat(pick([0xc22a2a, 0x1c1c20, 0xe0a100]), { roughness: .85 }));
  const s = new THREE.Shape(); s.moveTo(-.4, -.15); s.lineTo(-.4, .15); s.lineTo(-.2, .17); s.lineTo(.12, .16); s.quadraticCurveTo(.5, .14, .7, -.2); s.quadraticCurveTo(.4, .02, .1, -.12); s.lineTo(-.2, -.17); s.closePath();
  const head = mesh(new THREE.ExtrudeGeometry(s, { depth: .24, bevelEnabled: true, bevelSize: .02, bevelThickness: .025, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -.12), steel, 0, .6, 0);
  const face = mesh(new THREE.CylinderGeometry(.2, .2, .05, 16).rotateZ(Math.PI / 2), steel, -.42, .6, 0);
  return fit(group(handle, grip, head, face));
}
function screwdriver() {
  const col = pick([0xd62828, 0xf2b705, 0x1f6fd0]), hg = prof([[0, -.5], [.14, -.48], [.2, -.3], [.2, .2], [.15, .45], [.11, .52], [0, .53]], 32, 26), q = hg.attributes.position;
  for (let i = 0; i < q.count; i++) { const x = q.getX(i), z = q.getZ(i), k = 1 + .06 * Math.cos(8 * Math.atan2(z, x)); q.setX(i, x * k); q.setZ(i, z * k); } hg.computeVertexNormals();
  const chrome = mat(0xd9dde1, { metalness: 1, roughness: .18 }, 0xcccccc);
  const handle = mesh(hg, mat(col, { roughness: .35 })), cap = mesh(new THREE.CylinderGeometry(.13, .14, .08, 20), mat(0x15161a, { roughness: .6 }), 0, -.5, 0);
  const collar = mesh(new THREE.CylinderGeometry(.06, .08, .12, 6), chrome, 0, .58, 0), shaft = mesh(new THREE.CylinderGeometry(.032, .032, .95, 12), chrome, 0, 1.1, 0);
  const tipG = new THREE.BoxGeometry(.08, .16, .016).translate(0, 1.64, 0);
  return fit(group(handle, cap, collar, shaft, mesh(tipG, chrome)));
}
function pliers() {
  const steel = mat(0x8e969e, { metalness: .95, roughness: .35 }, 0xaaaaaa), rub = mat(pick([0xc22a2a, 0x1f5fbf, 0x1c1c20]), { roughness: .8 });
  const half = new THREE.Shape(); [[-.05, .02], [-.16, .46], [-.08, .53], [.02, .46], [.03, .06], [0, -.04], [0, -.8], [-.22, -.82], [-.14, -.06]].forEach((p, i) => i ? half.lineTo(p[0], p[1]) : half.moveTo(p[0], p[1]));
  const gripS = new THREE.Shape(); [[-.12, -.36], [-.235, -.84], [-.085, -.86], [.04, -.36]].forEach((p, i) => i ? gripS.lineTo(p[0], p[1]) : gripS.moveTo(p[0], p[1]));
  const ex = (s, d, z) => new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1 }).translate(0, 0, z);
  const mk = (sx, ang, z) => { const g = new THREE.Group(); g.add(new THREE.Mesh(ex(half, .05, z), steel), new THREE.Mesh(ex(gripS, .11, z - .03), rub)); g.scale.x = sx; g.rotation.z = ang; return g; };
  return fit(group(mk(1, .1, -.07), mk(-1, -.1, .02), mesh(new THREE.CylinderGeometry(.06, .06, .2, 14).rotateX(Math.PI / 2), steel)));
}
// ================= GAMBAR SENDIRI =================
export const customImgs = [];
export function addCustom(url) {
  return new Promise(res => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; customImgs.push({ t, a: t.image.width / t.image.height }); res(); }, undefined, () => res()));
}
const custom = () => {
  const { t, a } = pick(customImgs);
  return fit(new THREE.Mesh(new THREE.PlaneGeometry(1.5 * Math.min(a, 1.6), 1.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide })), 1.5);
};
const ALL = [book, pen, fish, jelly, apple, orange, banana, watermelon, strawberry, carrot, eggplant, broccoli, tomato, hammer, screwdriver, pliers];
export const THEMES = {
  buku:   { name: 'Buku', icon: '📚', build: book },
  pulpen: { name: 'Pulpen', icon: '🖊️', build: pen },
  laut:   { name: 'Hewan Laut', icon: '🐟', build: () => pick([fish, fish, jelly])() },
  buah:   { name: 'Buah', icon: '🍎', build: () => pick([apple, orange, banana, watermelon, strawberry])() },
  sayur:  { name: 'Sayur', icon: '🥕', build: () => pick([carrot, eggplant, broccoli, tomato])() },
  alat:   { name: 'Martil/Tang/Obeng', icon: '🔨', build: () => pick([hammer, screwdriver, pliers])() },
  campur: { name: 'Campur', icon: '🎲', build: () => pick(ALL)() },
  custom: { name: 'Gambar Saya', icon: '🖼️', flat: true, build: custom }
};
