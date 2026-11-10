import * as THREE from 'three';
import { WEAPONS, LEVELS } from './config.js';
import { THEMES, addCustom, customImgs } from './targets.js';

// ===== efek ledakan + tangan/senjata =====
const parts = [], box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(1, 10, 8);

function explode(scene, t) {
  const cols = []; t.traverse(o => { if (o.isMesh) cols.push(o.material.map ? 0xffffff : o.material.color.getHex()); });
  if (!cols.length) cols.push(0xffffff);
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true })), z = .08 + Math.random() * .18;
    m.scale.set(z * (.5 + Math.random()), z, z * (.5 + Math.random())); m.position.copy(t.position); scene.add(m);
    parts.push({ m, life: .9, max: .9,
      v: new THREE.Vector3(Math.random() - .5, Math.random() - .3, Math.random() - .5).normalize().multiplyScalar(3 + Math.random() * 6),
      w: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(12) });
  }
  const f = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffc04d, transparent: true, blending: THREE.AdditiveBlending }));
  f.position.copy(t.position); scene.add(f); parts.push({ m: f, flash: true, life: .25, max: .25, s: t.userData.r });
}
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i], k = (q.life -= dt) / q.max;
    if (q.flash) { q.m.scale.setScalar(q.s * (1 + (1 - k) * 2.5)); q.m.material.opacity = Math.max(0, k * .9); }
    else { q.v.y -= 9 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += q.w.x * dt; q.m.rotation.y += q.w.y * dt; q.m.material.opacity = Math.min(1, k * 2); }
    if (q.life <= 0) { q.m.parent.remove(q.m); q.m.material.dispose(); parts.splice(i, 1); }
  }
}
function clearFx() { while (parts.length) { const q = parts.pop(); q.m.parent && q.m.parent.remove(q.m); } }

// ---- tangan + senjata (first person, model menghadap +z) ----
const mat = c => new THREE.MeshLambertMaterial({ color: c });
const B = (w, h, d, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); return m; };
const C = (r, l, c, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), mat(c)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
const hand = (x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), mat(0xf1c27d)); m.position.set(x, y, z); return m; };

function makeView(type) {
  const g = new THREE.Group(); g.add(C(.06, .9, 0x23407a, 0, -.05, -.5));
  if (type === 'pistol') {
    g.add(B(.055, .17, .08, 0x2b2f36, 0, -.1, -.02), B(.06, .07, .32, 0x2b2f36, 0, .04, .13), C(.015, .1, 0x888888, 0, .04, .32), hand(0, -.04, -.03));
    const fl = new THREE.Mesh(ball, new THREE.MeshBasicMaterial({ color: 0xffe066 })); fl.scale.setScalar(.06); fl.position.set(0, .04, .42); g.add(fl); g.userData.flash = fl;
  } else if (type === 'knife') {
    const bl = B(.012, .07, .32, 0xdddddd, 0, 0, .26); g.add(B(.04, .04, .16, 0x5c3b1e, 0, 0, .02), bl, hand(0, 0, 0)); g.userData.proj = bl;
  } else {
    const bow = new THREE.Mesh(new THREE.TorusGeometry(.32, .015, 6, 18, Math.PI), mat(0x8b5a2b)); bow.rotation.set(0, -Math.PI / 2, -Math.PI / 2); bow.position.z = .1;
    const arr = C(.012, .55, 0xc9a066, 0, 0, .3); g.add(bow, C(.004, .64, 0xeeeeee, 0, 0, .1).rotateZ(Math.PI / 2).rotateY(0) && B(.004, .64, .004, 0xeeeeee, 0, 0, .1), arr, hand(0, 0, .1)); g.userData.proj = arr;
  }
  g.userData.flash && (g.userData.flash.visible = false);
  return g;
}
const _v = new THREE.Vector3();
function updateView(g, ndc, cam, kick, ready) {
  g.position.set(.32, -.3, -.65 + kick * .12);
  const d = 12, ty = Math.tan(cam.fov * Math.PI / 360);
  cam.updateMatrixWorld(true); g.lookAt(cam.localToWorld(_v.set(ndc.x * ty * cam.aspect * d, ndc.y * ty * d, -d)));
  if (g.userData.flash) g.userData.flash.visible = kick > .8;
  if (g.userData.proj) g.userData.proj.visible = ready;
}

// ===== game =====
const $ = s => document.querySelector(s);
const showErr = m => { const d = $('#err'); if (d) { d.hidden = false; d.textContent = '⚠ ' + m; } };
window.addEventListener('error', e => showErr(e.message));
window.addEventListener('unhandledrejection', e => showErr(String(e.reason)));
const sel = { theme: 'buah', weapon: 'pistol', level: 'easy' };

function chips(box, data, key) {
  box.innerHTML = '';
  for (const k in data) {
    const b = document.createElement('button');
    b.className = 'chip' + (sel[key] === k ? ' on' : '');
    b.textContent = (data[k].icon ? data[k].icon + ' ' : '') + data[k].name;
    b.onclick = () => { sel[key] = k; [...box.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); };
    box.append(b);
  }
}
const drawMenu = () => { chips($('#themes'), THEMES, 'theme'); chips($('#weapons'), WEAPONS, 'weapon'); chips($('#levels'), LEVELS, 'level'); };
drawMenu();
$('#file').onchange = e => { [...e.target.files].forEach(f => addCustom(URL.createObjectURL(f))); sel.theme = 'custom'; drawMenu(); };

// ---- scene ----
const renderer = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1630);
scene.fog = new THREE.Fog(0x0b1630, 15, 48);
const cam = new THREE.PerspectiveCamera(60, 1, .1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 1.8));
const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(3, 6, 4); scene.add(dl);
{ const p = []; for (let i = 0; i < 250; i++) p.push((Math.random() - .5) * 90, (Math.random() - .5) * 50, -30 - Math.random() * 20);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9db4ff, size: .15 }))); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 1 ? 78 : 60; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---- state ----
let running = false, hits = 0, shots = 0, shake = 0, kick = 0, view, player = 'Pemain', serverBest = {}, score = 0, combo = 0, timeLeft = 0, spawnT = 0, last = 0, ac;
const targets = [], projs = [], fx = [];
const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
const bestKey = () => 'shoot3d-best-' + sel.level;
const best = () => { let l = 0; try { l = +localStorage.getItem(bestKey()) || 0; } catch {} return Math.max(l, serverBest[sel.level] || 0); };
scene.add(cam);
const setView = () => { if (view) cam.remove(view); view = makeView(sel.weapon); view.visible = false; cam.add(view); };
async function api(url, body) { try { const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); return r.ok ? await r.json() : null; } catch { return null; } }
async function loadMe() {
  player = ($('#name').value.trim() || 'Pemain').slice(0, 20); try { localStorage.setItem('shoot3d-name', player); } catch {}
  const me = await api('/api/player?name=' + encodeURIComponent(player)); if (!me) return;
  serverBest = me.best || {};
  if (me.prefs) { for (const [k, D] of [['theme', THEMES], ['weapon', WEAPONS], ['level', LEVELS]]) if (me.prefs[k] in D && me.prefs[k] !== 'custom') sel[k] = me.prefs[k]; drawMenu(); }
}
async function board() {
  const r = await api('/api/leaderboard?level=' + sel.level), ol = $('#lb'); ol.innerHTML = '';
  (r?.rows || []).forEach((x, i) => { const li = document.createElement('li'); li.textContent = `${x.name} — ${x.score}`; if (x.name === player) li.className = 'me'; ol.append(li); });
}
try { $('#name').value = localStorage.getItem('shoot3d-name') || ''; } catch {}
$('#name').onchange = loadMe; loadMe();

function beep(f) {
  try { ac = ac || new AudioContext(); const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f; o.type = 'square'; g.gain.setValueAtTime(.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(.001, ac.currentTime + .12);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + .12); } catch {}
}

function spawn() {
  const L = LEVELS[sel.level], th = THEMES[sel.theme];
  const g = th.build(); g.scale.setScalar(L.size);
  const z = -(10 + Math.random() * 12), hh = Math.tan(cam.fov * Math.PI / 360) * -z, hw = hh * cam.aspect + 2, dir = Math.random() < .5 ? 1 : -1;
  g.position.set(-dir * hw, (Math.random() - .5) * hh * 1.3, z);
  Object.assign(g.userData, { vx: dir * L.speed * (.6 + Math.random() * .8), by: g.position.y, amp: Math.random() * 2, f: 1 + Math.random() * 2, age: 0, hw,
    spin: th.flat ? new THREE.Vector3(0, 0, .6) : new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(2), r: .8 * L.size, dead: 0 });
  scene.add(g); targets.push(g);
}
function removeFrom(arr, o) { scene.remove(o.m || o); const i = arr.indexOf(o); if (i >= 0) arr.splice(i, 1); }

function hit(t) {
  const u = t.userData; if (u.dead) return; u.dead = 1;
  combo++; hits++; score += 10 * LEVELS[sel.level].mult * Math.min(combo, 5); beep(880); explode(scene, t); shake = .6; removeFrom(targets, t);
}
const knife = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.05, .12, .6), new THREE.MeshBasicMaterial({ color: 0xdddddd })));
  const h = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .3), new THREE.MeshBasicMaterial({ color: 0x5c3b1e })); h.position.z = -.4; g.add(h); return g; };
const arrow = () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xc9a066 }));
  s.rotation.x = Math.PI / 2; const t = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  t.rotation.x = Math.PI / 2; t.position.z = .65; g.add(s, t); return g; };

function fire() {
  const now = performance.now() / 1000, W = WEAPONS[sel.weapon];
  if (now - last < W.cd) return; last = now; shots++; kick = 1; beep(W.f);
  ray.setFromCamera(ndc, cam);
  const o = ray.ray.origin.clone().add(new THREE.Vector3(0, -.5, -1).applyQuaternion(cam.quaternion)), d = ray.ray.direction.clone();
  if (!W.speed) {
    const h = ray.intersectObjects(targets.filter(t => !t.userData.dead), true)[0];
    const end = h ? h.point : o.clone().addScaledVector(d, 40);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([o, end]), new THREE.LineBasicMaterial({ color: 0xffe066 }));
    scene.add(line); fx.push({ m: line, life: .07 });
    if (h) { let t = h.object; while (t.parent !== scene) t = t.parent; hit(t); } else combo = 0;
  } else {
    const m = W.shape === 'knife' ? knife() : arrow(); m.position.copy(o); m.lookAt(o.clone().add(d)); scene.add(m);
    projs.push({ m, d, v: W.speed, r: W.r, life: 2 });
  }
}
function aim(e) {
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  $('#cross').style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
  cam.rotation.set(ndc.y * .06, -ndc.x * .12, 0);
}
addEventListener('pointermove', aim);
$('#c').addEventListener('pointerdown', e => { aim(e); if (running) fire(); });

function clearScene() { for (const a of [targets, projs, fx]) { for (const o of a) scene.remove(o.m || o); a.length = 0; } }

function start() {
  if (sel.theme === 'custom' && !customImgs.length) sel.theme = 'campur';
  clearScene(); clearFx(); try { setView(); } catch (e) { console.error(e); view = null; } hits = 0; shots = 0; score = 0; combo = 0; spawnT = 0; timeLeft = LEVELS[sel.level].time; running = true;
  player = ($('#name').value.trim() || 'Pemain').slice(0, 20); api('/api/player', { name: player, prefs: sel });
  if (view) view.visible = true; $('#menu').hidden = $('#end').hidden = true; $('#hud').hidden = false; $('#bs').textContent = best();
}
async function end() {
  running = false; if (view) view.visible = false; $('#hud').hidden = true;
  const b = Math.max(best(), score); try { localStorage.setItem(bestKey(), b); } catch {}
  serverBest[sel.level] = b;
  $('#endt').textContent = score >= LEVELS[sel.level].goal ? '🏆 Menang!' : '💥 Waktu Habis';
  $('#es').textContent = score; $('#eb').textContent = b; $('#end').hidden = false;
  await api('/api/score', { name: player, score, hits, shots, theme: sel.theme, weapon: sel.weapon, level: sel.level });
  board();
}
$('#start').onclick = $('#again').onclick = start;
$('#home').onclick = () => { $('#end').hidden = true; $('#menu').hidden = false; };
$('#quit').onclick = () => { running = false; if (view) view.visible = false; $('#hud').hidden = true; $('#menu').hidden = false; };

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min((ts - (loop.p || ts)) / 1000, .05); loop.p = ts;
  const L = LEVELS[sel.level];
  if (running) {
    timeLeft -= dt; spawnT -= dt;
    if (spawnT <= 0) { spawn(); spawnT = L.spawn * (.7 + Math.random() * .6); }
    if (timeLeft <= 0) end();
    $('#sc').textContent = score; $('#tm').textContent = Math.max(0, timeLeft | 0); $('#cb').textContent = Math.min(combo, 5);
  }
  for (const t of [...targets]) {
    const u = t.userData; u.age += dt;
    if (u.dead) { u.dead += dt; const s = L.size * (u.dead < .1 ? 1 + u.dead * 4 : Math.max(0, 1.4 - (u.dead - .1) * 5.6)); t.scale.setScalar(Math.max(s, .0001)); if (s <= 0) removeFrom(targets, t); continue; }
    t.position.x += u.vx * dt; t.position.y = u.by + Math.sin(u.age * u.f) * u.amp;
    t.rotation.x += u.spin.x * dt; t.rotation.y += u.spin.y * dt; t.rotation.z += u.spin.z * dt;
    if (u.age > 1 && Math.abs(t.position.x) > u.hw + 1) removeFrom(targets, t);
  }
  for (const p of [...projs]) {
    p.m.position.addScaledVector(p.d, p.v * dt); p.life -= dt;
    const t = targets.find(t => !t.userData.dead && t.position.distanceTo(p.m.position) < t.userData.r + p.r);
    if (t) { hit(t); removeFrom(projs, p); } else if (p.life <= 0) { combo = 0; removeFrom(projs, p); }
  }
  updateFx(dt); kick = Math.max(0, kick - dt * 6); shake = Math.max(0, shake - dt * 3);
  cam.position.set((Math.random() - .5) * shake * .2, (Math.random() - .5) * shake * .2, 0);
  if (view) updateView(view, ndc, cam, kick, performance.now() / 1000 - last >= WEAPONS[sel.weapon].cd * .9);
  for (const f of [...fx]) { f.life -= dt; if (f.life <= 0) removeFrom(fx, f); }
  renderer.render(scene, cam);
}
requestAnimationFrame(loop);
