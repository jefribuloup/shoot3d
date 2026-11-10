import * as THREE from 'three';
import { WEAPONS, LEVELS } from './config.js';
import { THEMES, addCustom, customImgs } from './targets.js';

const $ = s => document.querySelector(s);
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
let running = false, score = 0, combo = 0, timeLeft = 0, spawnT = 0, last = 0, ac;
const targets = [], projs = [], fx = [];
const ndc = new THREE.Vector2(), ray = new THREE.Raycaster();
const bestKey = () => 'shoot3d-best-' + sel.level;
const best = () => { try { return +localStorage.getItem(bestKey()) || 0; } catch { return 0; } };

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
  const u = t.userData; if (u.dead) return; u.dead = .001;
  combo++; score += 10 * LEVELS[sel.level].mult * Math.min(combo, 5); beep(880);
}
const knife = () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(.05, .12, .6), new THREE.MeshBasicMaterial({ color: 0xdddddd })));
  const h = new THREE.Mesh(new THREE.BoxGeometry(.07, .1, .3), new THREE.MeshBasicMaterial({ color: 0x5c3b1e })); h.position.z = -.4; g.add(h); return g; };
const arrow = () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0xc9a066 }));
  s.rotation.x = Math.PI / 2; const t = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
  t.rotation.x = Math.PI / 2; t.position.z = .65; g.add(s, t); return g; };

function fire() {
  const now = performance.now() / 1000, W = WEAPONS[sel.weapon];
  if (now - last < W.cd) return; last = now; beep(W.f);
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
  clearScene(); score = 0; combo = 0; spawnT = 0; timeLeft = LEVELS[sel.level].time; running = true;
  $('#menu').hidden = $('#end').hidden = true; $('#hud').hidden = false; $('#bs').textContent = best();
}
function end() {
  running = false; $('#hud').hidden = true;
  const b = Math.max(best(), score); try { localStorage.setItem(bestKey(), b); } catch {}
  $('#endt').textContent = score >= LEVELS[sel.level].goal ? '🏆 Menang!' : '💥 Waktu Habis';
  $('#es').textContent = score; $('#eb').textContent = b; $('#end').hidden = false;
}
$('#start').onclick = $('#again').onclick = start;
$('#home').onclick = () => { $('#end').hidden = true; $('#menu').hidden = false; };
$('#quit').onclick = () => { running = false; $('#hud').hidden = true; $('#menu').hidden = false; };

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
  for (const f of [...fx]) { f.life -= dt; if (f.life <= 0) removeFrom(fx, f); }
  renderer.render(scene, cam);
}
requestAnimationFrame(loop);
